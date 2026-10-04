export default function HomePage() {
  return (
    <main className="foundation">
      <section className="foundation__card" aria-labelledby="foundation-title">
        <p className="foundation__eyebrow">iCamp2027</p>
        <h1 id="foundation-title">Campground operations platform</h1>
        <p>
          Repository foundation established. The next build will create the
          responsive application shell for campers, staff, maintenance, POS, and
          management.
        </p>
        <dl className="foundation__status">
          <div>
            <dt>Production branch</dt>
            <dd>main</dd>
          </div>
          <div>
            <dt>Integration branch</dt>
            <dd>dev</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>001</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
