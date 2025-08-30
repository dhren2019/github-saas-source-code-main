/**
 * Load .env files early so the env validation in `src/env.js` can read `process.env`.
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "dotenv/config";
await import("./src/env.js");

/** @type {import("next").NextConfig} */
const config = {
  images: {
    domains: ["img.clerk.com"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // Ignore all optional template engines that consolidate.js (used by @vue/compiler-sfc) tries to load
    const templateEngines = [
      'atpl', 'dot', 'dust', 'dustjs-linkedin', 'dustjs-helpers', 'eco', 'ect', 'ejs', 'haml-coffee', 'hamljs', 'hamlet', 'handlebars', 
      'hogan.js', 'htmling', 'jade', 'jazz', 'jqtpl', 'just', 'liquor', 'lodash', 'marko', 'mote', 'mustache', 
      'nunjucks', 'plates', 'pug', 'qejs', 'ractive', 'razor', 'react', 'react-dom/server', 'slm', 'squirrelly', 
      'swig', 'teacup', 'templayed', 'toffee', 'twig', 'twing', 'underscore', 'vash', 'velocityjs', 'walrus', 
      'whiskers', 'coffee-script', 'coffee', 'livescript', 'bracket-template', 'babel-core', 'tinyliquid',
      'liquid-node', 'then-jade', 'then-pug', 'swig-templates', 'razor-tmpl', 'arc-templates/dist/es5',
      'teacup/lib/express'
    ];

    // @ts-ignore - Dynamic fallback assignment
    const fallbacks = {};
    templateEngines.forEach(engine => {
      fallbacks[engine] = false;
    });

    config.resolve.fallback = {
      ...config.resolve.fallback,
      ...fallbacks
    };
    
    return config;
  },
};

export default config;
