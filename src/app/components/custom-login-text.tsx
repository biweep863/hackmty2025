// ~/app/_components/custom-login-text.tsx

import React from "react";
import { signIn } from "next-auth/react"; // Assuming you are in a client component or using a client wrapper

interface CustomLoginTextProps {
  text: string;
  label: string;
}

const CustomLoginText: React.FC<CustomLoginTextProps> = ({ text, label }) => {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center rounded-lg bg-gray-800 p-8 text-center shadow-xl">
      <p className="mb-6 text-lg text-gray-300">{text}</p>
      <button
        onClick={() => signIn()}
        className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-md transition duration-150 hover:bg-indigo-500"
      >
        {label}
      </button>
    </div>
  );
};

// IMPORTANT: Your availability page.tsx is an `async` Server Component,
// but the `signIn` function from `next-auth/react` only works in Client Components.
// You must wrap this component with `"use client"` or create a client wrapper
// to handle the button's onClick event if you use this exact implementation.

// For a simple Server Component placeholder, you could use a standard <a> tag
// linked to your sign-in route, or, more typically, you'd make this file a
// Client Component by adding 'use client' at the top.
// For this example, let's make it a client component for functionality:

// Add 'use client' at the very top of this file in your project:
// "use client";

export default CustomLoginText;
