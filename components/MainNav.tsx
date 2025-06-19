'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Home, Settings } from 'lucide-react';

export function MainNav() {
  const pathname = usePathname();
  
  const navItems: { name: string; href: string; icon: React.ElementType }[] = [];
  
  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center text-sm font-medium transition-colors hover:text-primary ${
              isActive
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <item.icon className="h-4 w-4 mr-2" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
