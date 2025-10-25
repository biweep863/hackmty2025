// ~/app/_components/header.tsx

import React from "react";

interface HeaderProps {
  title: string;
  subtitle: string;
}

const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <header className="fixed top-0 left-0 z-10 w-full border-b border-gray-700 bg-gray-900 pt-4 pb-2 md:pt-6 md:pb-3">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-400 md:text-base">{subtitle}</p>
      </div>
    </header>
  );
};

export default Header;
