# RSS Feed Aggregator

A Next.js application that aggregates and displays RSS feeds. Built with Next.js, Prisma, and SQLite.

## Features

- Add and manage multiple RSS feeds
- Automatic feed refresh system
- Display feed items with title, description, author, and category
- SQLite database for persistent storage
- Modern, responsive UI with Tailwind CSS

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the database:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) with your browser

## Database Management

You can use Prisma Studio to manage the database:
```bash
npx prisma studio
```

## Feed Refresh System

The application includes an automatic feed refresh system that can be triggered in two ways:

1. **Manual Refresh**: Visit `/api/refresh` in your browser or make a GET request to that endpoint
2. **Automatic Refresh**: Set up a cron job or use a service like Uptime Robot to hit the `/api/refresh` endpoint at regular intervals

Recommended refresh intervals:
- Every 15 minutes for news feeds
- Every hour for blog feeds
- Every 24 hours for less frequently updated feeds

## API Routes

- `POST /api/feeds` - Add a new RSS feed
- `GET /api/feeds` - Get all feeds and their items
- `GET /api/refresh` - Refresh all feeds

## Environment Variables

Create a `.env` file in the root directory:
```env
DATABASE_URL="file:./dev.db"
```

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Prisma](https://www.prisma.io) - Database ORM
- [SQLite](https://www.sqlite.org) - Database
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [RSS Parser](https://www.npmjs.com/package/rss-parser) - RSS feed parsing

## Deployment

This application can be deployed to any platform that supports Next.js applications. Make sure to:

1. Set up the environment variables
2. Run the database migrations
3. Configure the feed refresh system

For the feed refresh system in production, you can use:
- Cron jobs
- Scheduled tasks
- External monitoring services

Make sure to secure the `/api/refresh` endpoint in production if needed.
