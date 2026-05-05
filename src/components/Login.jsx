import React, { useEffect, useRef } from 'react';

// ID de cliente de Google (Público)
const GOOGLE_CLIENT_ID = "365692313483-g4tv5i5agl4egs67h980vn6ce977p7df.apps.googleusercontent.com";

export default function Login({ onLoginSuccess }) {
  const googleBtnRef = useRef(null);

  useEffect(() => {
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          // El response.credential es el JWT (ID Token)
          onLoginSuccess(response.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'pill',
      });
    }
  }, [onLoginSuccess]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-background-tertiary)',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--color-background-primary)',
        borderRadius: 'var(--border-radius-lg)',
        padding: 40,
        boxShadow: 'var(--shadow-card)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        <div>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>Task Manager</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8 }}>
            Sincroniza tus tareas, notas y calendario en todos tus dispositivos.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44 }}></div>
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', opacity: 0.7 }}>
          Al iniciar sesión, tus datos se guardarán de forma segura en la nube.
        </div>
      </div>
    </div>
  );
}
