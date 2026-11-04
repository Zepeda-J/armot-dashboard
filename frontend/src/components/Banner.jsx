export default function Banner({ icono, titulo, subtitulo, pills = [] }) {
  return (
    <div className="banner">
      <div className="banner-l">
        <div className="banner-logo" aria-hidden="true">{icono}</div>
        <div>
          <div className="banner-title">{titulo}</div>
          <div className="banner-sub">{subtitulo}</div>
        </div>
      </div>
      <div className="banner-r">
        {pills.map((p, i) => (
          <span className="pill" key={i}>{p}</span>
        ))}
      </div>
    </div>
  );
}
