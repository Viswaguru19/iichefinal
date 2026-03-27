export default async function HomePage() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-black relative">
      <iframe
        src="https://iicheavvu.netlify.app"
        title="IIChE AVVU Landing"
        className="h-full w-full border-0"
        allow="camera; microphone; fullscreen"
      />
      <a
        href="/login"
        aria-label="Portal login"
        title="Portal login"
        className="absolute top-0 right-0 z-30 h-20 w-56 rounded-none bg-transparent"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              window.addEventListener('keydown', function (e) {
                if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
                  e.preventDefault();
                  window.location.href = 'https://iicheavvu.netlify.app/signin';
                }
              });
            })();
          `,
        }}
      />
    </div>
  );
}
