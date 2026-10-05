'use client';

/**
 * Last-resort boundary for failures in the root layout itself (providers,
 * theme, global CSS injection). Must render its own <html>/<body> because
 * the normal shell is what crashed. Reset requires a full reload.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f4f6f5',
          color: '#16241c',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 420,
            border: '1px solid #e3e9e5',
            background: '#ffffff',
            padding: '40px 32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: 22,
            }}
          >
            ⚠️
          </div>
          <h1 style={{ fontSize: 18, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#4a5c52', margin: '0 0 24px', lineHeight: 1.55 }}>
            The application failed to start. A reload usually fixes it &mdash; if it
            keeps happening, contact support.
          </p>
          <button
            onClick={reset}
            style={{
              height: 40,
              padding: '0 20px',
              background: '#0b3b24',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: 13.5,
              cursor: 'pointer',
            }}
          >
            Reload application
          </button>
          {error.digest ? (
            <p style={{ marginTop: 20, fontSize: 11, color: '#7c8b82', fontFamily: 'monospace' }}>
              Error code: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
