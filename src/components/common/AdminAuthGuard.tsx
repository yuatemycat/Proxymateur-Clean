import React from 'react';

/**
 * AdminAuthGuard
 * In Proxymateur-Clean (non-proxy edition), remote web-mode auth lockouts are disabled.
 * Renders children directly without intercepting.
 */
export const AdminAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return <>{children}</>;
};
