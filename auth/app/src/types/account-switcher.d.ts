import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "account-switcher": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { "auth-url": string; "api-base"?: string; variant?: "icon" | "compact" | "full" };
      "friink-onboarding": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { "auth-url": string; "session-url": string; "complete-url": string; "return-to"?: string };
    }
  }
}

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "account-switcher": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { "auth-url": string; "api-base"?: string; variant?: "icon" | "compact" | "full" };
      "friink-onboarding": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { "auth-url": string; "session-url": string; "complete-url": string; "return-to"?: string };
    }
  }
}
