import { useEffect, useRef, useState } from 'react';

// ID de cliente de Google (Público)
const GOOGLE_CLIENT_ID = "365692313483-g4tv5i5agl4egs67h980vn6ce977p7df.apps.googleusercontent.com";

export default function Login({ onLoginSuccess }) {
  const googleBtnRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const mount = googleBtnRef.current;

    const init = () => {
      if (cancelled || !mount || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            setError('');
            await onLoginSuccess(response.credential);
          } catch {
            setError('No se pudo iniciar sesión. Revisa la configuración de Google/Cloudflare.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(mount, {
        theme: 'outline',
        size: 'large',
        width: '100%',
        text: 'signin_with',
        shape: 'pill',
      });
    };

    if (window.google?.accounts?.id) {
      init();
      return () => { cancelled = true; };
    }

    const interval = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(interval);
        init();
      }
    }, 50);
    const timeout = window.setTimeout(() => window.clearInterval(interval), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [onLoginSuccess]);

  return (
    <div className="login-page">
      <div className="login-card">
        <div>
          <div className="login-mark">T</div>
          <h1>Task Manager</h1>
          <p>
            Sincroniza tus tareas, notas y calendario en todos tus dispositivos.
          </p>
        </div>

        <div className="login-actions">
          <div ref={googleBtnRef} style={{ width: '100%', minHeight: 44, display: 'flex', justifyContent: 'center' }}></div>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}
        </div>

        <div className="login-note">
          Al iniciar sesión, tus datos se guardarán de forma segura en la nube.
        </div>
      </div>
    </div>
  );
}
