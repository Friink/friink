import type * as React from 'react';

type AccountSwitcherProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  'auth-url'?: string;
  'api-base'?: string;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements { 'account-switcher': AccountSwitcherProps; }
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements { 'account-switcher': AccountSwitcherProps; }
  }
}

export {};
