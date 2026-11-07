export function UnderConstructionPage({ title }: { title: string }) {
  return (
    <section className="construction-page" aria-labelledby="construction-title">
      <div>
        <h1 id="construction-title">{title}</h1>
        <p>Em construção</p>
      </div>
    </section>
  );
}
