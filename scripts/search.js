#!/usr/bin/env node

/**
 * Lightweight CLI wrapper around common web search APIs (Google Custom Search, Bing Web Search).
 *
 * Usage:
 *   node scripts/search.js "inventory management best practices"
 *   node scripts/search.js --engine bing "warehouse audit checklist"
 *
 * Required environment variables:
 *   Google Custom Search: GOOGLE_CSE_KEY, GOOGLE_CSE_CX
 *   Bing Web Search:      BING_SEARCH_KEY [, BING_SEARCH_ENDPOINT defaults to https://api.bing.microsoft.com/v7.0/search]
 *
 * The script prints a concise list of search results (title, URL, snippet).
 */

const { env, argv, exit } = process;

const ENGINES = {
  google: 'google',
  bing: 'bing',
};

function printUsage() {
  console.log(
    [
      'Usage: node scripts/search.js [--engine google|bing] <query>',
      '',
      'Environment variables:',
      '  Google Custom Search -> GOOGLE_CSE_KEY, GOOGLE_CSE_CX',
      '  Bing Web Search      -> BING_SEARCH_KEY [, BING_SEARCH_ENDPOINT]',
      '',
      'Examples:',
      '  node scripts/search.js "inventory management best practices"',
      '  node scripts/search.js --engine bing "warehouse audit checklist"',
    ].join('\n'),
  );
}

function parseArgs(rawArgs) {
  const args = [...rawArgs];

  let engineArgIndex = args.indexOf('--engine');
  let engine = env.SEARCH_ENGINE;
  if (engineArgIndex !== -1) {
    if (engineArgIndex === args.length - 1) {
      console.error('Missing value for --engine flag.');
      printUsage();
      exit(1);
    }
    engine = args[engineArgIndex + 1].toLowerCase();
    args.splice(engineArgIndex, 2);
  }

  if (!engine) {
    if (env.GOOGLE_CSE_KEY && env.GOOGLE_CSE_CX) {
      engine = ENGINES.google;
    } else if (env.BING_SEARCH_KEY) {
      engine = ENGINES.bing;
    }
  }

  if (engine && !Object.values(ENGINES).includes(engine)) {
    console.error(`Unsupported engine "${engine}". Supported engines: google | bing.`);
    exit(1);
  }

  const query = args.join(' ').trim();
  if (!query) {
    console.error('Missing search query.');
    printUsage();
    exit(1);
  }

  return { engine, query };
}

async function runGoogleSearch(query) {
  const apiKey = env.GOOGLE_CSE_KEY;
  const cx = env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    throw new Error('Google Custom Search requires GOOGLE_CSE_KEY and GOOGLE_CSE_CX to be set.');
  }

  const endpoint = new URL('https://www.googleapis.com/customsearch/v1');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('cx', cx);
  endpoint.searchParams.set('q', query);

  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google search failed with status ${response.status}: ${response.statusText}\n${body}`,
    );
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items.map((item) => ({
    title: item.title || 'Untitled result',
    link: item.link || '',
    snippet: item.snippet || '',
  }));
}

async function runBingSearch(query) {
  const apiKey = env.BING_SEARCH_KEY;
  const endpoint = env.BING_SEARCH_ENDPOINT || 'https://api.bing.microsoft.com/v7.0/search';

  if (!apiKey) {
    throw new Error('Bing Web Search requires BING_SEARCH_KEY to be set.');
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set('q', query);
  requestUrl.searchParams.set('mkt', env.BING_SEARCH_MARKET || 'en-US');

  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/json',
      'Ocp-Apim-Subscription-Key': apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Bing search failed with status ${response.status}: ${response.statusText}\n${body}`,
    );
  }

  const data = await response.json();
  const webPages = data.webPages && Array.isArray(data.webPages.value) ? data.webPages.value : [];

  return webPages.map((item) => ({
    title: item.name || 'Untitled result',
    link: item.url || '',
    snippet: item.snippet || item.displayUrl || '',
  }));
}

function formatResults(results, engine, query) {
  if (!results.length) {
    return `No results found for "${query}" via ${engine}.`;
  }

  const formatted = results.slice(0, 10).map((item, index) => {
    const snippet = item.snippet ? `    ${item.snippet.replace(/\s+/g, ' ').trim()}` : '';
    return `${index + 1}. ${item.title}\n   ${item.link}\n${snippet}`;
  });

  return formatted.join('\n\n');
}

async function main() {
  try {
    const { engine = ENGINES.google, query } = parseArgs(argv.slice(2));

    const searchRunner = engine === ENGINES.bing ? runBingSearch : runGoogleSearch;

    const results = await searchRunner(query);
    console.log(formatResults(results, engine, query));
  } catch (error) {
    console.error(error.message || error);
    exit(1);
  }
}

main();
