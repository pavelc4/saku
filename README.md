<p align="center">
<img src="https://img.shields.io/badge/TypeScript-000000?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Cloudflare_Workers-000000?style=for-the-badge&logo=cloudflare&logoColor=f38020" alt="Cloudflare">
<a href="https://github.com/pavelc4/saku/releases"><img src="https://img.shields.io/github/v/release/pavelc4/saku?label=Release&style=for-the-badge&logo=github&logoColor=white&labelColor=222" alt="Latest Release"></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/MIT-white?style=for-the-badge&logo=andela&logoColor=white&label=License&labelColor=222" alt="License"></a>
</p>

## About SAKU

**SAKU** is a modern, fast, and edge-native financial record-keeping backend designed aiming to simplify accounting for Indonesian UMKM (MSMEs).
Built entirely on the Cloudflare ecosystem using the **Hono** framework, it leverages D1 for SQL databases, R2 for object storage, KV for caching, and Cloudflare AI for intelligent financial summaries.

## Features

- **Secure Authentication** - Credential login and OAuth (Google & GitHub) with KV-based Session Management.
- **Transactions & Categories** - Robust double-entry inspired APIs with D1 batch inserts.
- **Object Storage** - Secure, private receipt uploads up to 5MB utilizing Cloudflare R2.
- **AI Financial Insights** - Smart, localized financial summaries generated via `@cf/meta/llama-3-8b-instruct`.
- **Edge Deployment** - Microsecond latencies deployed directly to the closest Cloudflare Edge nodes.

## Tech Stack

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Hono](https://hono.dev/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) (S3-compatible Storage)
- [Cloudflare KV](https://developers.cloudflare.com/kv/)
- [Cloudflare AI Binding](https://developers.cloudflare.com/workers-ai/)

## Resources

- [API Documentation](docs/api.md) - Find out how to connect to the backend
- [Releases](https://github.com/pavelc4/saku/releases) - Download latest version
- [Issues](https://github.com/pavelc4/saku/issues) - Report bugs

## Stargazers over time

[![Stargazers over time](https://starchart.cc/pavelc4/saku.svg?variant=adaptive)](https://starchart.cc/pavelc4/saku)

## License

SAKU is open-sourced software licensed under the [MIT license](LICENSE).
