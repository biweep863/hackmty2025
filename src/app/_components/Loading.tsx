"use client";

import React from "react";

type LoadingProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean; // when true, don't render the full-height wrapper
};

export default function Loading({ className = "", size = "md", inline = false }: LoadingProps) {
  const sizeClass =
    size === "sm"
      ? "h-4 w-4 border-t-2 border-b-2"
      : size === "lg"
      ? "h-16 w-16 border-t-4 border-b-4"
      : "h-12 w-12 border-t-4 border-b-4"; // md

  const spinner = (
    <div className={`animate-spin rounded-full ${sizeClass} border-red-600 ${className}`} />
  );

  if (inline) return spinner;

  return <div className="flex items-center justify-center h-64">{spinner}</div>;
}
