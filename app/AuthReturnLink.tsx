"use client";

import { useSyncExternalStore } from "react";

type AuthReturnLinkProps = {
  children: React.ReactNode;
  className?: string;
};

function buildReturnTo() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener("hashchange", callback); };
};

export function AuthReturnLink({ children, className }: AuthReturnLinkProps) {
  const returnTo = useSyncExternalStore(subscribe, buildReturnTo, () => "/");
  const href = `/signin?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <a className={className} href={href}>
      {children}
    </a>
  );
}
