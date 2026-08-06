"use client";

import { useEffect, useState } from "react";

type AuthReturnLinkProps = {
  children: React.ReactNode;
  className?: string;
};

function buildReturnTo() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.hash || ""}`;
}

export function AuthReturnLink({ children, className }: AuthReturnLinkProps) {
  const [href, setHref] = useState("/signin?returnTo=/");

  useEffect(() => {
    setHref(`/signin?returnTo=${encodeURIComponent(buildReturnTo())}`);
  }, []);

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
