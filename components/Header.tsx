'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MainNav } from './MainNav';

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center justify-center">
        <Link href="/">
          <Image 
            src="/images/header.png" 
            alt="Header Logo" 
            width={300}
            height={60}
            style={{ maxHeight: '60px', width: 'auto' }}
            priority
          />
        </Link>
      </div>
    </header>
  );
}
