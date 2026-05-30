export function containsUsername(text = "", username = "") {
  if (!text || !username) return false;
  console.log(text, username);
  const normalize = (str) => {
    return str
      .toLowerCase()
      .replace(/[@#]/g, "")
      .replace(/[_\-.]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedText = normalize(text);

  const normalizedUsername = normalize(username);

  // full compact match
  const compactText = normalizedText.replace(/\s/g, "");

  const compactUsername = normalizedUsername.replace(/\s/g, "");

  if (compactText.includes(compactUsername)) {
    return true;
  }

  // split username words
  const usernameWords = normalizedUsername.split(" ");

  // every username word should exist
  return usernameWords.every((word) => normalizedText.includes(word));
}
