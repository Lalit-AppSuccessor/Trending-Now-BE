import axios from "axios";

import Article from "../models/ArticleStore.js";
import Creator from "../models/Creator.js";

import {
  BREAKING_KEYWORDS,
  CREATOR_NAMES,
  HAPPENING_KEYWORDS,
} from "../constants/keywords.js";

const NEWS_API_CHUNK_SIZE = 1;
const CURRENTS_CHUNK_SIZE = 1;

function chunkArray(array, size) {
  const chunks = [];

  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }

  return chunks;
}

function getQueryTerms(creator, limit = 10) {
  return [creator.name, ...(creator.keywords || []).slice(0, limit)];
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function syncNewsFeed() {
  try {
    console.log("sync started...");

    const newsApiChunks = chunkArray(CREATOR_NAMES, NEWS_API_CHUNK_SIZE);

    const currentsChunks = chunkArray(CREATOR_NAMES, CURRENTS_CHUNK_SIZE);

    let newsApiArticles = [];

    let currentsArticles = [];

    // ======================
    // CURRENTS API
    // ======================

    for (const chunk of currentsChunks) {
      try {
        const creatorQuery = chunk
          .flatMap((creator) => getQueryTerms(creator, 15))
          .map((term) => `"${term}"`)
          .join(" OR ");

        const q = `(${creatorQuery})`;

        console.log("currents:", q);

        const response = await axios.get(
          "https://api.currentsapi.services/v1/search",
          {
            params: {
              apiKey: process.env.CURRENTS_API_KEY,

              query: q,

              language: "en",
            },
          },
        );

        const articles = (response.data.news || []).map((item) => ({
          title: item.title || "",

          description: item.description || "",

          content: item.content || "",

          author: item.author || "",

          url: item.url || "",

          urlToImage: item.image || "",

          source: {
            name: item.author || "",
          },

          publishedAt: item.published || "",
        }));

        currentsArticles.push(...articles);
      } catch (error) {
        console.log("currents failed:", error?.response?.data || error.message);
      }

      await delay(2000);
    }

    // ======================
    // NEWS API
    // ======================

    let newsApiDisabled = false;

    for (const chunk of newsApiChunks) {
      try {
        if (newsApiDisabled) break;

        const creatorQuery = chunk
          .flatMap((creator) => getQueryTerms(creator, 8))
          .map((term) => `"${term}"`)
          .join(" OR ");

        const q = `(${creatorQuery}) AND (youtube OR influencer OR creator OR instagram)`;
        console.log(q, "newsapi query");
        const response = await axios.get("https://newsapi.org/v2/everything", {
          params: {
            q,

            language: "en",

            sortBy: "publishedAt",

            pageSize: 100,

            apiKey: process.env.NEWS_API_KEY,
          },
        });

        newsApiArticles.push(...(response.data.articles || []));
      } catch (error) {
        const err = error?.response?.data;

        console.log("newsapi failed:", err || error.message);

        if (err?.code === "rateLimited") {
          newsApiDisabled = true;
        }
      }

      await delay(2000);
    }

    // ======================
    // MERGE ARTICLES
    // ======================

    const articles = [...newsApiArticles, ...currentsArticles];

    console.log("newsapi:", newsApiArticles.length);

    console.log("currents:", currentsArticles.length);

    console.log("total:", articles.length);

    // ======================
    // DEDUPE ARTICLES
    // ======================

    const uniqueArticles = [
      ...new Map(
        articles
          .filter((a) => a?.url)
          .map((a) => [a.url.trim().toLowerCase(), a]),
      ).values(),
    ];

    console.log("unique:", uniqueArticles.length);

    const creatorMap = {};
    const bulkOps = [];

    for (const article of uniqueArticles) {
      const searchableText = `
    ${article.title || ""}
    ${article.description || ""}
    ${article.content || ""}
    ${article.url || ""}
    ${article.author || ""}
    ${article.source?.name || ""}
  `.toLowerCase();

      const creatorScores = [];

      for (const creator of CREATOR_NAMES) {
        const searchTerms = [
          creator.name,
          creator.channelName?.replace("@", ""),
          ...(creator.keywords || []),
        ]
          .filter(Boolean)
          .map((x) => x.toLowerCase());

        let score = 0;

        for (const term of searchTerms) {
          const searchableWords = new Set(
            searchableText.toLowerCase().split(/\W+/),
          );

          const matches = term
            .toLowerCase()
            .split(/\s+/)
            .every((word) => searchableWords.has(word));

          if (matches) {
            score += term.length > 10 ? 8 : 4;
          }
          // console.log(matches, term.length);
        }

        if (score > 0) {
          creatorScores.push({
            creator,
            score,
          });
        }
      }

      if (!creatorScores.length) continue;

      creatorScores.sort((a, b) => b.score - a.score);

      const matchedCreator = creatorScores[0].creator;

      const isBreaking = BREAKING_KEYWORDS.some((keyword) =>
        searchableText.includes(keyword.toLowerCase()),
      );

      const isAlsoHappening = HAPPENING_KEYWORDS.some((keyword) =>
        searchableText.includes(keyword.toLowerCase()),
      );

      let trendingScore = 10;

      if (isBreaking) trendingScore += 50;

      if (isAlsoHappening) trendingScore += 20;

      trendingScore += (article.title || "").length * 0.2;
      trendingScore += (article.description || "").split(" ").length * 0.1;

      bulkOps.push({
        updateOne: {
          filter: {
            url: article.url,
          },
          update: {
            $set: {
              title: article.title,
              description: article.description,
              content: article.content,
              author: article.author,
              url: article.url,
              urlToImage: article.urlToImage,
              source: article.source,
              publishedAt: article.publishedAt,

              creatorName: matchedCreator.name,
              creatorChannel: matchedCreator.channelName,

              isBreaking,
              isAlsoHappening,
              trendingScore,
            },
          },
          upsert: true,
        },
      });

      if (!creatorMap[matchedCreator.name]) {
        creatorMap[matchedCreator.name] = {
          creator: matchedCreator,
          articleCount: 0,
          breakingCount: 0,
          score: 0,
        };
      }

      creatorMap[matchedCreator.name].articleCount++;
      creatorMap[matchedCreator.name].score += trendingScore;

      if (isBreaking) {
        creatorMap[matchedCreator.name].breakingCount++;
      }
    }

    if (bulkOps.length) {
      await Article.bulkWrite(bulkOps, {
        ordered: false,
      });
    }

    const totalSaved = Object.values(creatorMap).reduce(
      (sum, creator) => sum + creator.articleCount,
      0,
    );

    console.log("Total saved count:", totalSaved);

    console.log("news synced!!");

    return {
      success: true,
      totalArticles: articles.length,
    };
  } catch (error) {
    console.log("syncNewsFeed error:", error);

    return {
      success: false,
    };
  }
}
