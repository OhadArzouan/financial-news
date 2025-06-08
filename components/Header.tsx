'use client';

import React from 'react';
import Link from 'next/link';
import { MainNav } from './MainNav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center">
        <Link href="/" className="font-bold text-xl mr-6">
          RSS Feed Aggregator
        </Link>
        <MainNav />
      </div>
    </header>
  );
}
