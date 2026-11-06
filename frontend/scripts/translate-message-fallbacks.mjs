import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const messagesDir = path.join(frontendDir, "messages");
const source = JSON.parse(await readFile(path.join(messagesDir, "en.json"), "utf8"));

const localeTargets = {
  fa: "fa",
  ar: "ar",
  zh: "zh-CN",
};

const requestedLocales = process.argv.slice(2);
const locales = requestedLocales.length > 0 ? requestedLocales : Object.keys(localeTargets);
const cache = new Map();

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

function shouldTranslate(sourceValue, targetValue) {
  return (
    typeof sourceValue === "string"
    && (targetValue === undefined || targetValue === sourceValue)
    && /[A-Za-z]{3}/.test(sourceValue)
    && !/^https?:\/\//.test(sourceValue)
    && !/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(sourceValue)
    && !/^\/[A-Za-z0-9_./-]+$/.test(sourceValue)
  );
}

function protectTokens(value) {
  const tokens = [];
  const protectedValue = value.replace(
    /\{[^{}]+\}|Halvaa|FastAPI|Mapbox|MapLibre|Google|Stripe|QR|NEXT_PUBLIC_[A-Z0-9_]+|\/m\/john-doe/g,
    (token) => {
      const marker = ` HALVAATOKEN${tokens.length} `;
      tokens.push(token);
      return marker;
    },
  );
  return { protectedValue, tokens };
}

function restoreTokens(value, tokens) {
  return tokens.reduce(
    (current, token, index) =>
      current.replace(new RegExp(`\\s*HALVAATOKEN${index}\\s*`, "g"), token),
    value,
  );
}

async function translateText(value, targetLocale) {
  const cacheKey = `${targetLocale}:${value}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const { protectedValue, tokens } = protectTokens(value);
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", "en");
  endpoint.searchParams.set("tl", targetLocale);
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("q", protectedValue);

  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Translation request failed with ${response.status}`);
      }
      const payload = await response.json();
      const translated = payload?.[0]
        ?.map((part) => part?.[0] ?? "")
        .join("");
      if (!translated) throw new Error("Translation response was empty");
      const restored = restoreTokens(translated, tokens).trim();
      cache.set(cacheKey, restored);
      return restored;
    } catch (error) {
      lastError = error;
      await delay(300 * attempt);
    }
  }
  throw lastError;
}

function collectFallbacks(sourceNode, targetNode, pathParts = [], output = []) {
  if (Array.isArray(sourceNode)) {
    sourceNode.forEach((value, index) => {
      collectFallbacks(value, targetNode?.[index], [...pathParts, index], output);
    });
    return output;
  }

  if (sourceNode && typeof sourceNode === "object") {
    Object.entries(sourceNode).forEach(([key, value]) => {
      collectFallbacks(value, targetNode?.[key], [...pathParts, key], output);
    });
    return output;
  }

  if (shouldTranslate(sourceNode, targetNode)) {
    output.push({ pathParts, value: sourceNode });
  }
  return output;
}

function setAtPath(target, pathParts, value) {
  let current = target;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const part = pathParts[index];
    const nextPart = pathParts[index + 1];
    if (current[part] === undefined) {
      current[part] = typeof nextPart === "number" ? [] : {};
    }
    current = current[part];
  }
  current[pathParts.at(-1)] = value;
}

for (const locale of locales) {
  const targetLanguage = localeTargets[locale];
  if (!targetLanguage) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  const targetPath = path.join(messagesDir, `${locale}.json`);
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  const fallbacks = collectFallbacks(source, target);

  console.log(`${locale}: translating ${fallbacks.length} English fallbacks`);
  let completed = 0;
  for (const fallback of fallbacks) {
    const translated = await translateText(fallback.value, targetLanguage);
    setAtPath(target, fallback.pathParts, translated);
    completed += 1;
    if (completed % 25 === 0 || completed === fallbacks.length) {
      console.log(`${locale}: ${completed}/${fallbacks.length}`);
    }
    await delay(35);
  }

  await writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`, "utf8");
}
