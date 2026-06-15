import SocialAllDump from "../models/SocialAllDump.js";
import { bucket } from "../service/firebaseStorage.js";
import sharp from "sharp";

let mediaSyncRunning = false;

async function uploadInstagramMediaToFirebase(creatorName, postId, media) {
  const response = await fetch(media.url);

  if (!response.ok) {
    throw new Error(`Download failed ${response.status}`);
  }

  let buffer = Buffer.from(await response.arrayBuffer());

  let extension = media.type === "video" ? "mp4" : "jpg";

  let contentType = media.type === "video" ? "video/mp4" : "image/jpeg";

  if (media.type === "image") {
    buffer = await sharp(buffer)
      .rotate()
      .resize({
        width: 1280,
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 65,
        mozjpeg: true,
      })
      .toBuffer();
  }

  const path = `instagram/${creatorName}/${postId}/${media.type}.${extension}`;

  const file = bucket.file(path);

  await file.save(buffer, {
    resumable: false,
    public: true,
    metadata: {
      contentType,
    },
  });

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}

export async function syncInstagramMedia() {
  if (mediaSyncRunning) {
    console.log("Media sync already running");
    return;
  }

  mediaSyncRunning = true;

  try {
    console.log("Starting media sync");

    const dumps = await SocialAllDump.find({
      updatedAt: {
        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
      instagram: {
        $exists: true,
        $ne: [],
      },
    });

    for (const dump of dumps) {
      let modified = false;

      for (const post of dump.instagram || []) {
        for (const [mediaIndex, media] of (post.media || []).entries()) {
          if (media.firebaseUrl && (!media.poster || media.firebasePoster)) {
            continue;
          }

          try {
            if (!media.firebaseUrl && media.url) {
              media.firebaseUrl = await uploadInstagramMediaToFirebase(
                dump.creatorName,
                `${post.postId}/${mediaIndex}`,
                media,
              );

              modified = true;
            }

            if (media.poster && !media.firebasePoster) {
              const posterMedia = {
                url: media.poster,
                type: "image",
              };

              media.firebasePoster = await uploadInstagramMediaToFirebase(
                dump.creatorName,
                `${post.postId}/${mediaIndex}/poster`,
                posterMedia,
              );

              modified = true;
            }

            media.uploadedAt = new Date();

            console.log(
              `Uploaded ${dump.creatorName}/${post.postId}/${mediaIndex}`,
            );
          } catch (err) {
            console.log("Upload failed", dump.creatorName, err.message);
          }
        }
      }

      if (modified) {
        dump.markModified("instagram");

        await dump.save();
      }
    }

    console.log("Media sync completed");
  } catch (err) {
    console.error("Media sync failed", err);
  } finally {
    mediaSyncRunning = false;
  }
}
