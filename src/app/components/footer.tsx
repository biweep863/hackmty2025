// ~/app/_components/footer.tsx

import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="mt-8 border-t border-gray-700 bg-gray-900 py-4">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-gray-500 sm:px-6 lg:px-8">
        &copy; {new Date().getFullYear()} Carpooler App. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
