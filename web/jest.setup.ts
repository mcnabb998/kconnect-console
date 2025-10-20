import '@testing-library/jest-dom';
import React from 'react';

jest.mock('next/link', () => {
  const Link = React.forwardRef<HTMLAnchorElement, { href: string; children: React.ReactNode }>(
    ({ children, href, ...rest }, ref) => React.createElement('a', { href, ref, ...rest }, children)
  );
  Link.displayName = 'MockNextLink';
  return Link;
});

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
  useSearchParams: jest.fn()
}));
