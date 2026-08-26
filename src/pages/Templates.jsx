import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "../App.css";

const TEMPLATES = [
  {
    id: "business",
    name: "Business",
    category: "Business",
    description:
      "Professional business website with hero, services, about and contact sections.",
    icon: "🏢",
    prompt:
      "Create a modern professional business website with hero, services, about, testimonials and contact sections.",

    html: `
<header class="site-header">
  <div class="container nav">
    <a href="#" class="logo">NEXORA</a>
    <nav>
      <a href="#services">Services</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
    <a href="#contact" class="nav-btn">Get Started</a>
  </div>
</header>

<main>
  <section class="hero">
    <div class="container hero-content">
      <span class="eyebrow">BUILD • GROW • SCALE</span>
      <h1>We build brands that <span>move forward.</span></h1>
      <p>
        Smart digital solutions designed to help modern businesses
        grow faster and connect with more customers.
      </p>
      <div class="hero-actions">
        <a href="#contact" class="btn primary">Start a Project</a>
        <a href="#services" class="btn secondary">Explore Services</a>
      </div>
    </div>
  </section>

  <section class="stats">
    <div class="container stats-grid">
      <div><strong>120+</strong><span>Projects</span></div>
      <div><strong>48</strong><span>Brands</span></div>
      <div><strong>98%</strong><span>Happy Clients</span></div>
      <div><strong>7+</strong><span>Years Experience</span></div>
    </div>
  </section>

  <section id="services" class="section">
    <div class="container">
      <div class="section-heading">
        <span>WHAT WE DO</span>
        <h2>Everything your business needs.</h2>
      </div>

      <div class="cards">
        <article class="card">
          <div class="card-icon">✦</div>
          <h3>Brand Strategy</h3>
          <p>Build a strong identity that makes your business memorable.</p>
        </article>

        <article class="card">
          <div class="card-icon">◈</div>
          <h3>Web Development</h3>
          <p>Fast, responsive and conversion-focused digital experiences.</p>
        </article>

        <article class="card">
          <div class="card-icon">↗</div>
          <h3>Growth Marketing</h3>
          <p>Reach the right audience and turn visitors into customers.</p>
        </article>
      </div>
    </div>
  </section>

  <section id="about" class="section about">
    <div class="container about-grid">
      <div>
        <span class="eyebrow">ABOUT NEXORA</span>
        <h2>Ideas into meaningful digital experiences.</h2>
      </div>
      <p>
        We combine strategy, creativity and technology to create
        digital products that are beautiful, useful and built for growth.
      </p>
    </div>
  </section>

  <section id="contact" class="section contact">
    <div class="container contact-box">
      <span class="eyebrow">LET'S TALK</span>
      <h2>Ready to build something great?</h2>
      <p>Tell us about your next project.</p>
      <button class="btn primary contact-btn">Contact Us</button>
    </div>
  </section>
</main>

<footer>
  <div class="container footer">
    <span>© 2026 NEXORA</span>
    <span>Built with WebAI</span>
  </div>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
  background: #090b11;
  color: #fff;
}

a {
  color: inherit;
  text-decoration: none;
}

.container {
  width: min(1120px, 90%);
  margin: auto;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(9,11,17,.82);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.nav {
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
}

.logo {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 2px;
}

nav {
  display: flex;
  gap: 28px;
}

nav a {
  color: #aeb4c7;
  font-size: 14px;
}

nav a:hover {
  color: #fff;
}

.nav-btn,
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  padding: 13px 20px;
  font-weight: 800;
  cursor: pointer;
}

.nav-btn {
  background: #fff;
  color: #090b11;
  font-size: 13px;
}

.hero {
  min-height: 78vh;
  display: flex;
  align-items: center;
  text-align: center;
  background:
    radial-gradient(circle at 50% 10%, #42328b 0, transparent 38%),
    #090b11;
}

.hero-content {
  max-width: 900px;
}

.eyebrow,
.section-heading > span {
  color: #a996ff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 3px;
}

.hero h1 {
  font-size: clamp(48px, 8vw, 88px);
  line-height: .98;
  margin: 24px 0;
  letter-spacing: -4px;
}

.hero h1 span {
  color: #a996ff;
}

.hero p {
  max-width: 650px;
  margin: auto;
  color: #aeb4c7;
  line-height: 1.8;
  font-size: 17px;
}

.hero-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 35px;
}

.primary {
  background: #fff;
  color: #090b11;
}

.secondary {
  border: 1px solid rgba(255,255,255,.15);
  color: #fff;
}

.stats {
  border-block: 1px solid rgba(255,255,255,.08);
  background: rgba(255,255,255,.025);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4,1fr);
}

.stats-grid div {
  padding: 35px 20px;
  text-align: center;
  border-right: 1px solid rgba(255,255,255,.07);
}

.stats-grid div:last-child {
  border: 0;
}

.stats strong,
.stats span {
  display: block;
}

.stats strong {
  font-size: 30px;
}

.stats span {
  margin-top: 6px;
  color: #8f96ab;
  font-size: 13px;
}

.section {
  padding: 100px 0;
}

.section-heading {
  max-width: 700px;
  margin-bottom: 45px;
}

.section-heading h2,
.about h2,
.contact h2 {
  font-size: clamp(36px,5vw,58px);
  line-height: 1.05;
  margin: 15px 0 0;
}

.cards {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 18px;
}

.card {
  padding: 32px;
  border: 1px solid rgba(255,255,255,.09);
  border-radius: 22px;
  background: rgba(255,255,255,.035);
}

.card-icon {
  font-size: 30px;
  margin-bottom: 30px;
}

.card h3 {
  font-size: 22px;
}

.card p,
.about p,
.contact p {
  color: #9da5ba;
  line-height: 1.8;
}

.about {
  background: #0e1119;
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  align-items: center;
}

.contact {
  text-align: center;
}

.contact-box {
  max-width: 850px;
}

.contact-btn {
  border: 0;
  margin-top: 25px;
}

footer {
  border-top: 1px solid rgba(255,255,255,.08);
}

.footer {
  min-height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #737b91;
  font-size: 13px;
}

@media(max-width:700px) {
  nav {
    display: none;
  }

  .nav-btn {
    display: none;
  }

  .hero h1 {
    letter-spacing: -2px;
  }

  .hero-actions,
  .about-grid {
    grid-template-columns: 1fr;
    display: grid;
  }

  .stats-grid {
    grid-template-columns: repeat(2,1fr);
  }

  .cards {
    grid-template-columns: 1fr;
  }

  .stats-grid div:nth-child(2) {
    border-right: 0;
  }

  .stats-grid div:nth-child(-n+2) {
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".contact-btn")?.addEventListener("click", function() {
  alert("Thanks! We will contact you soon.");
});
`,
  },

  {
    id: "portfolio",
    name: "Portfolio",
    category: "Portfolio",
    description:
      "Modern personal portfolio for designers, developers and creators.",
    icon: "👤",
    prompt:
      "Create a modern personal portfolio website with hero, about, skills, projects, experience and contact sections.",

    html: `
<header class="portfolio-header">
  <div class="wrap nav">
    <a href="#" class="brand">Alex<span>.</span></a>

    <nav>
      <a href="#work">Work</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </nav>
  </div>
</header>

<main>
  <section class="portfolio-hero">
    <div class="wrap">
      <span class="tag">CREATIVE DEVELOPER</span>
      <h1>Designing digital experiences people remember.</h1>
      <p>
        I create clean, interactive and purposeful websites
        for brands, startups and ambitious people.
      </p>

      <a href="#work" class="portfolio-btn">View My Work ↓</a>
    </div>
  </section>

  <section id="work" class="portfolio-section">
    <div class="wrap">
      <div class="heading">
        <span>SELECTED WORK</span>
        <h2>Projects I’m proud of.</h2>
      </div>

      <div class="work-grid">
        <article class="work-card">
          <div class="work-image one">01</div>
          <h3>Fintech Dashboard</h3>
          <p>Product Design · Development</p>
        </article>

        <article class="work-card">
          <div class="work-image two">02</div>
          <h3>Creative Studio</h3>
          <p>Branding · Web Design</p>
        </article>

        <article class="work-card">
          <div class="work-image three">03</div>
          <h3>Travel Platform</h3>
          <p>UX · Development</p>
        </article>
      </div>
    </div>
  </section>

  <section id="about" class="portfolio-section about">
    <div class="wrap about-grid">
      <div>
        <span class="tag">ABOUT ME</span>
        <h2>A developer who cares about details.</h2>
      </div>

      <div>
        <p>
          I turn ideas into thoughtful digital products by combining
          design thinking, modern technology and a little creativity.
        </p>

        <div class="skills">
          <span>React</span>
          <span>JavaScript</span>
          <span>UI/UX</span>
          <span>CSS</span>
        </div>
      </div>
    </div>
  </section>

  <section id="contact" class="portfolio-contact">
    <div class="wrap">
      <span class="tag">HAVE A PROJECT?</span>
      <h2>Let’s create something together.</h2>
      <button class="portfolio-btn contact-btn">Say Hello →</button>
    </div>
  </section>
</main>

<footer class="portfolio-footer">
  <div class="wrap">
    <span>Alex Studio</span>
    <span>© 2026</span>
  </div>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #f4f1eb;
  color: #151515;
  font-family: Inter, Arial, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.wrap {
  width: min(1120px, 90%);
  margin: auto;
}

.portfolio-header {
  background: #f4f1eb;
  border-bottom: 1px solid #ddd8ce;
}

.nav {
  height: 80px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  font-size: 26px;
  font-weight: 900;
}

.brand span {
  color: #ff5c35;
}

nav {
  display: flex;
  gap: 28px;
}

nav a {
  font-size: 14px;
  color: #66615b;
}

.portfolio-hero {
  padding: 140px 0;
  background:
    radial-gradient(circle at 80% 20%, #ffb49f, transparent 25%),
    #f4f1eb;
}

.tag,
.heading > span {
  color: #ff5c35;
  font-size: 12px;
  letter-spacing: 3px;
  font-weight: 900;
}

.portfolio-hero h1 {
  max-width: 900px;
  font-size: clamp(48px,8vw,92px);
  line-height: .98;
  letter-spacing: -5px;
  margin: 25px 0;
}

.portfolio-hero p {
  max-width: 600px;
  color: #68625b;
  line-height: 1.8;
  font-size: 17px;
}

.portfolio-btn {
  display: inline-block;
  margin-top: 30px;
  padding: 15px 22px;
  border-radius: 30px;
  background: #151515;
  color: #fff;
  font-weight: 800;
  border: 0;
  cursor: pointer;
}

.portfolio-section {
  padding: 100px 0;
}

.heading h2,
.about h2,
.portfolio-contact h2 {
  font-size: clamp(38px,5vw,62px);
  line-height: 1;
  margin: 15px 0 50px;
  letter-spacing: -2px;
}

.work-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 20px;
}

.work-card {
  cursor: pointer;
}

.work-image {
  height: 360px;
  border-radius: 22px;
  display: flex;
  align-items: flex-end;
  padding: 25px;
  font-size: 50px;
  font-weight: 900;
  color: rgba(255,255,255,.8);
  transition: transform .3s;
}

.work-card:hover .work-image {
  transform: translateY(-8px);
}

.one {
  background: linear-gradient(135deg,#20242f,#6576a0);
}

.two {
  background: linear-gradient(135deg,#241916,#d56b48);
}

.three {
  background: linear-gradient(135deg,#18312c,#5d9e8d);
}

.work-card h3 {
  margin: 20px 0 6px;
}

.work-card p {
  color: #77716a;
  margin: 0;
}

.about {
  background: #191919;
  color: #fff;
}

.about-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
}

.about p {
  color: #aaa;
  line-height: 1.9;
}

.skills {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 25px;
}

.skills span {
  border: 1px solid #444;
  border-radius: 30px;
  padding: 9px 15px;
  color: #ddd;
  font-size: 13px;
}

.portfolio-contact {
  padding: 120px 0;
  text-align: center;
}

.portfolio-contact h2 {
  max-width: 800px;
  margin: 20px auto;
}

.portfolio-footer {
  border-top: 1px solid #ddd8ce;
}

.portfolio-footer .wrap {
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #77716a;
}

@media(max-width:700px) {
  nav {
    display: none;
  }

  .portfolio-hero {
    padding: 100px 0;
  }

  .portfolio-hero h1 {
    letter-spacing: -3px;
  }

  .work-grid,
  .about-grid {
    grid-template-columns: 1fr;
  }

  .work-image {
    height: 300px;
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".contact-btn")?.addEventListener("click", function() {
  alert("Hello! Thanks for reaching out.");
});
`,
  },

  {
    id: "restaurant",
    name: "Restaurant",
    category: "Restaurant",
    description:
      "Premium restaurant website with menu, story and reservation CTA.",
    icon: "🍔",
    prompt:
      "Create a premium restaurant website with hero, menu, about, gallery, reservation and contact sections.",

    html: `
<header class="restaurant-header">
  <div class="restaurant-nav">
    <a href="#" class="restaurant-logo">LUNA</a>

    <nav>
      <a href="#menu">Menu</a>
      <a href="#story">Our Story</a>
      <a href="#reserve">Reservations</a>
    </nav>
  </div>
</header>

<main>
  <section class="restaurant-hero">
    <div class="hero-overlay">
      <span>EST. 1998 • DHAKA</span>
      <h1>Good food.<br>Good moments.</h1>
      <p>Seasonal ingredients, thoughtful cooking and unforgettable evenings.</p>
      <a href="#reserve" class="gold-btn">Reserve a Table</a>
    </div>
  </section>

  <section id="menu" class="menu-section">
    <div class="menu-heading">
      <span>OUR MENU</span>
      <h2>Made with intention.</h2>
      <p>Simple ingredients. Exceptional flavors.</p>
    </div>

    <div class="menu-grid">
      <article>
        <span>STARTER</span>
        <h3>Truffle Crostini <strong>$9</strong></h3>
        <p>Wild mushrooms, truffle cream and herbs.</p>
      </article>

      <article>
        <span>MAIN</span>
        <h3>Herb Chicken <strong>$19</strong></h3>
        <p>Roasted chicken, seasonal vegetables and jus.</p>
      </article>

      <article>
        <span>MAIN</span>
        <h3>Signature Pasta <strong>$16</strong></h3>
        <p>Fresh pasta, parmesan and slow-cooked tomato.</p>
      </article>

      <article>
        <span>DESSERT</span>
        <h3>Chocolate Tart <strong>$8</strong></h3>
        <p>Dark chocolate, sea salt and vanilla cream.</p>
      </article>
    </div>
  </section>

  <section id="story" class="story">
    <div>
      <span>OUR STORY</span>
      <h2>A table is better when everyone feels welcome.</h2>
    </div>

    <p>
      Luna was created around a simple idea: bring people together
      over beautiful food. Every dish is prepared with fresh,
      seasonal ingredients and a lot of care.
    </p>
  </section>

  <section id="reserve" class="reservation">
    <span>RESERVATIONS</span>
    <h2>Your table is waiting.</h2>
    <p>Join us for dinner, drinks and memorable moments.</p>
    <button class="gold-btn reserve-btn">Book a Table</button>
  </section>
</main>

<footer class="restaurant-footer">
  <span>LUNA RESTAURANT</span>
  <span>Dhaka • Bangladesh</span>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #120e0b;
  color: #f8f1e7;
  font-family: Georgia, serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.restaurant-header {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
}

.restaurant-nav {
  width: min(1120px,90%);
  height: 90px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.restaurant-logo {
  font-size: 28px;
  letter-spacing: 5px;
}

.restaurant-nav nav {
  display: flex;
  gap: 30px;
}

.restaurant-nav nav a {
  color: #ddd0c0;
  font-size: 14px;
}

.restaurant-hero {
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  background:
    linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.8)),
    radial-gradient(circle at center,#765035,#120e0b);
}

.hero-overlay {
  width: min(800px,90%);
}

.hero-overlay > span,
.menu-heading > span,
.story > div > span,
.reservation > span {
  color: #d5a35d;
  letter-spacing: 4px;
  font-size: 11px;
  font-weight: bold;
}

.restaurant-hero h1 {
  font-size: clamp(55px,9vw,100px);
  line-height: .9;
  font-weight: 400;
  margin: 25px 0;
}

.restaurant-hero p {
  max-width: 600px;
  margin: auto;
  color: #d2c3b3;
  line-height: 1.8;
}

.gold-btn {
  display: inline-block;
  margin-top: 30px;
  padding: 14px 25px;
  background: #d5a35d;
  color: #1b120b;
  border: 0;
  font-weight: bold;
  cursor: pointer;
}

.menu-section {
  padding: 110px 8%;
}

.menu-heading {
  text-align: center;
  margin-bottom: 60px;
}

.menu-heading h2,
.story h2,
.reservation h2 {
  font-size: clamp(38px,5vw,65px);
  font-weight: 400;
  margin: 15px 0;
}

.menu-heading p {
  color: #a99b8c;
}

.menu-grid {
  max-width: 1000px;
  margin: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 45px 70px;
}

.menu-grid article {
  border-bottom: 1px solid #3a3028;
  padding-bottom: 25px;
}

.menu-grid article > span {
  color: #d5a35d;
  font-size: 10px;
  letter-spacing: 3px;
}

.menu-grid h3 {
  display: flex;
  justify-content: space-between;
  font-size: 21px;
  font-weight: 400;
}

.menu-grid strong {
  color: #d5a35d;
}

.menu-grid p {
  color: #9e9184;
  line-height: 1.7;
}

.story {
  padding: 110px 10%;
  background: #1b1511;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: center;
}

.story p {
  color: #b4a79b;
  line-height: 2;
  font-size: 17px;
}

.reservation {
  padding: 120px 20px;
  text-align: center;
}

.reservation p {
  color: #a99b8c;
}

.restaurant-footer {
  border-top: 1px solid #352b24;
  padding: 30px 8%;
  display: flex;
  justify-content: space-between;
  color: #8d8073;
  font-size: 12px;
  letter-spacing: 2px;
}

@media(max-width:700px) {
  .restaurant-nav nav {
    display: none;
  }

  .menu-grid,
  .story {
    grid-template-columns: 1fr;
  }

  .restaurant-hero h1 {
    font-size: 55px;
  }

  .story {
    padding: 80px 8%;
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".reserve-btn")?.addEventListener("click", function() {
  alert("Reservation request received!");
});
`,
  },

  {
    id: "landing",
    name: "Landing Page",
    category: "Landing Page",
    description:
      "High-converting landing page for products, apps and services.",
    icon: "🚀",
    prompt:
      "Create a premium high-converting landing page with hero, features, benefits, testimonials, pricing and CTA sections.",

    html: `
<header class="landing-header">
  <div class="landing-nav">
    <a href="#" class="landing-logo">NOVA</a>

    <nav>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#reviews">Reviews</a>
    </nav>

    <a href="#pricing" class="small-btn">Get Started</a>
  </div>
</header>

<main>
  <section class="landing-hero">
    <div class="hero-badge">✦ THE FUTURE OF WORK</div>

    <h1>Work smarter.<br><span>Move faster.</span></h1>

    <p>
      Nova gives modern teams everything they need to
      organize, collaborate and grow from one beautiful workspace.
    </p>

    <div class="landing-actions">
      <button class="main-btn">Start for Free →</button>
      <a href="#features" class="text-btn">Explore Features</a>
    </div>

    <div class="dashboard-preview">
      <div class="preview-sidebar"></div>
      <div class="preview-content">
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  </section>

  <section id="features" class="landing-section">
    <div class="section-title">
      <span>POWERFUL FEATURES</span>
      <h2>Everything in one place.</h2>
    </div>

    <div class="feature-grid">
      <article>
        <b>01</b>
        <h3>Simple Workflow</h3>
        <p>Keep your entire workflow organized without unnecessary complexity.</p>
      </article>

      <article>
        <b>02</b>
        <h3>Team Collaboration</h3>
        <p>Bring your team together and get more done in less time.</p>
      </article>

      <article>
        <b>03</b>
        <h3>Smart Analytics</h3>
        <p>Understand your progress with clear and powerful insights.</p>
      </article>
    </div>
  </section>

  <section id="reviews" class="testimonial">
    <span>LOVED BY TEAMS</span>
    <blockquote>
      “Nova completely changed the way our team works.
      Everything feels simpler and faster.”
    </blockquote>
    <p>— Sarah Morgan, Product Lead</p>
  </section>

  <section id="pricing" class="pricing">
    <span>PRICING</span>
    <h2>Start free. Grow when ready.</h2>

    <div class="price-card">
      <small>PRO</small>
      <strong>$19<span>/month</span></strong>
      <p>Everything you need to build and grow.</p>
      <button class="main-btn price-btn">Start Free Trial</button>
    </div>
  </section>

  <section class="final-cta">
    <h2>Ready to move faster?</h2>
    <p>Start building your better workflow today.</p>
    <button class="main-btn final-btn">Get Started →</button>
  </section>
</main>

<footer>
  <span>NOVA</span>
  <span>© 2026 Nova Inc.</span>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
  background: #f7f8fc;
  color: #11131b;
}

a {
  color: inherit;
  text-decoration: none;
}

.landing-header {
  background: rgba(247,248,252,.85);
  backdrop-filter: blur(15px);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid #e5e7ef;
}

.landing-nav {
  width: min(1150px,90%);
  height: 75px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.landing-logo {
  font-weight: 900;
  font-size: 22px;
  letter-spacing: 2px;
}

.landing-nav nav {
  display: flex;
  gap: 28px;
}

.landing-nav nav a {
  color: #686d7b;
  font-size: 14px;
}

.small-btn,
.main-btn {
  border: 0;
  cursor: pointer;
  font-weight: 800;
}

.small-btn {
  padding: 11px 17px;
  border-radius: 10px;
  background: #11131b;
  color: white;
  font-size: 13px;
}

.landing-hero {
  padding: 120px 20px 80px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 10%,#dcd4ff,transparent 38%),
    #f7f8fc;
}

.hero-badge,
.section-title span,
.testimonial > span,
.pricing > span {
  font-size: 11px;
  letter-spacing: 3px;
  font-weight: 900;
  color: #6753d9;
}

.landing-hero h1 {
  font-size: clamp(55px,9vw,100px);
  line-height: .92;
  letter-spacing: -6px;
  margin: 25px 0;
}

.landing-hero h1 span {
  color: #6753d9;
}

.landing-hero > p {
  max-width: 650px;
  margin: auto;
  color: #6d7280;
  line-height: 1.8;
}

.landing-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  align-items: center;
  margin-top: 32px;
}

.main-btn {
  padding: 15px 22px;
  border-radius: 12px;
  background: #6753d9;
  color: white;
}

.text-btn {
  color: #555b6d;
  font-weight: 700;
}

.dashboard-preview {
  width: min(900px,90%);
  height: 360px;
  margin: 70px auto 0;
  border: 1px solid #dfe2eb;
  border-radius: 20px;
  background: white;
  display: grid;
  grid-template-columns: 150px 1fr;
  overflow: hidden;
  box-shadow: 0 25px 80px rgba(30,35,70,.15);
}

.preview-sidebar {
  background: #151722;
}

.preview-content {
  padding: 35px;
}

.preview-content div {
  height: 55px;
  background: #f0f1f7;
  border-radius: 10px;
  margin-bottom: 18px;
}

.landing-section {
  padding: 110px 8%;
}

.section-title {
  text-align: center;
  margin-bottom: 55px;
}

.section-title h2,
.pricing h2,
.final-cta h2 {
  font-size: clamp(38px,5vw,60px);
  letter-spacing: -2px;
  margin: 15px 0;
}

.feature-grid {
  max-width: 1050px;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 18px;
}

.feature-grid article {
  background: white;
  border: 1px solid #e3e5ec;
  border-radius: 20px;
  padding: 32px;
}

.feature-grid b {
  color: #6753d9;
}

.feature-grid p,
.testimonial p,
.pricing p,
.final-cta p {
  color: #717687;
  line-height: 1.8;
}

.testimonial {
  padding: 120px 20px;
  background: #151722;
  color: white;
  text-align: center;
}

.testimonial blockquote {
  max-width: 850px;
  margin: 25px auto;
  font-size: clamp(30px,5vw,52px);
  line-height: 1.15;
}

.testimonial p {
  color: #999eae;
}

.pricing {
  padding: 110px 20px;
  text-align: center;
}

.price-card {
  max-width: 430px;
  margin: 45px auto 0;
  padding: 40px;
  background: white;
  border: 1px solid #e1e4ed;
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(30,35,70,.08);
}

.price-card small {
  color: #6753d9;
  font-weight: 900;
  letter-spacing: 2px;
}

.price-card strong {
  display: block;
  font-size: 60px;
  margin: 20px 0;
}

.price-card strong span {
  font-size: 16px;
  color: #777;
}

.final-cta {
  padding: 110px 20px;
  text-align: center;
  background: #ebe8ff;
}

footer {
  padding: 30px 8%;
  display: flex;
  justify-content: space-between;
  color: #777d8e;
  font-size: 13px;
}

@media(max-width:700px) {
  .landing-nav nav {
    display: none;
  }

  .landing-hero h1 {
    letter-spacing: -3px;
  }

  .landing-actions {
    flex-direction: column;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .dashboard-preview {
    height: 260px;
    grid-template-columns: 90px 1fr;
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".main-btn")?.addEventListener("click", function() {
  alert("Welcome to Nova! Your free trial is ready.");
});

document.querySelector(".final-btn")?.addEventListener("click", function() {
  alert("Let's get started!");
});
`,
  },

  {
    id: "saas",
    name: "SaaS",
    category: "SaaS",
    description:
      "Modern SaaS product website with features, integrations and pricing.",
    icon: "⚡",
    prompt:
      "Create a modern SaaS website with hero, features, integrations, pricing, testimonials, FAQ and CTA sections.",

    html: `
<header class="saas-header">
  <div class="saas-nav">
    <a href="#" class="saas-logo">FLOW<span>OS</span></a>

    <nav>
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </nav>

    <a href="#pricing" class="saas-btn">Start Free</a>
  </div>
</header>

<main>
  <section class="saas-hero">
    <div class="saas-badge">⚡ POWERING MODERN TEAMS</div>

    <h1>Your team's new<br><span>operating system.</span></h1>

    <p>
      Plan projects, manage tasks and collaborate with your team
      from one powerful workspace.
    </p>

    <button class="saas-main-btn">Start for Free →</button>

    <div class="saas-dashboard">
      <aside></aside>
      <section>
        <div class="dash-title"></div>
        <div class="dash-cards">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="dash-table"></div>
      </section>
    </div>
  </section>

  <section id="features" class="saas-section">
    <div class="saas-heading">
      <span>ONE WORKSPACE</span>
      <h2>Everything your team needs.</h2>
    </div>

    <div class="saas-features">
      <article>
        <b>⌁</b>
        <h3>Project Management</h3>
        <p>Plan, organize and track every project with ease.</p>
      </article>

      <article>
        <b>◎</b>
        <h3>Team Collaboration</h3>
        <p>Keep conversations, files and tasks in one place.</p>
      </article>

      <article>
        <b>↗</b>
        <h3>Analytics</h3>
        <p>Get real-time insights into your team's performance.</p>
      </article>
    </div>
  </section>

  <section class="integration">
    <span>INTEGRATIONS</span>
    <h2>Works with your favorite tools.</h2>

    <div class="integration-list">
      <span>Slack</span>
      <span>GitHub</span>
      <span>Notion</span>
      <span>Google Drive</span>
    </div>
  </section>

  <section id="pricing" class="saas-pricing">
    <span>PRICING</span>
    <h2>Simple pricing.</h2>

    <div class="plans">
      <article>
        <small>STARTER</small>
        <strong>$0</strong>
        <p>For individuals getting started.</p>
        <button class="outline-btn">Get Started</button>
      </article>

      <article class="featured">
        <small>PRO</small>
        <strong>$29</strong>
        <p>For growing teams and businesses.</p>
        <button class="saas-main-btn">Start Free</button>
      </article>
    </div>
  </section>

  <section id="faq" class="faq">
    <span>FAQ</span>
    <h2>Questions, answered.</h2>

    <details>
      <summary>Can I try FlowOS for free?</summary>
      <p>Yes. Start with our free plan and upgrade whenever you need.</p>
    </details>

    <details>
      <summary>Can I cancel anytime?</summary>
      <p>Absolutely. You can cancel your subscription whenever you want.</p>
    </details>
  </section>
</main>

<footer>
  <span>FLOWOS</span>
  <span>© 2026 FlowOS</span>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #080b12;
  color: #f8f9ff;
  font-family: Inter, Arial, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.saas-header {
  border-bottom: 1px solid rgba(255,255,255,.08);
  background: rgba(8,11,18,.85);
  backdrop-filter: blur(15px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.saas-nav {
  width: min(1150px,90%);
  height: 76px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.saas-logo {
  font-weight: 900;
  letter-spacing: 1px;
}

.saas-logo span {
  color: #8d7aff;
}

.saas-nav nav {
  display: flex;
  gap: 30px;
}

.saas-nav nav a {
  color: #9298aa;
  font-size: 14px;
}

.saas-btn,
.saas-main-btn {
  background: #8d7aff;
  color: white;
  border: 0;
  cursor: pointer;
  font-weight: 800;
}

.saas-btn {
  padding: 11px 17px;
  border-radius: 9px;
  font-size: 13px;
}

.saas-main-btn {
  padding: 14px 22px;
  border-radius: 11px;
}

.saas-hero {
  padding: 120px 20px 80px;
  text-align: center;
  background:
    radial-gradient(circle at 50% 10%,#302761,transparent 35%),
    #080b12;
}

.saas-badge,
.saas-heading span,
.integration > span,
.saas-pricing > span,
.faq > span {
  color: #9a8cff;
  font-size: 11px;
  letter-spacing: 3px;
  font-weight: 900;
}

.saas-hero h1 {
  font-size: clamp(55px,9vw,100px);
  line-height: .92;
  letter-spacing: -5px;
  margin: 25px 0;
}

.saas-hero h1 span {
  color: #9a8cff;
}

.saas-hero > p {
  max-width: 650px;
  margin: auto auto 30px;
  color: #969cad;
  line-height: 1.8;
}

.saas-dashboard {
  width: min(950px,90%);
  height: 400px;
  margin: 70px auto 0;
  display: grid;
  grid-template-columns: 170px 1fr;
  background: #111620;
  border: 1px solid #252c3b;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 30px 90px rgba(0,0,0,.5);
}

.saas-dashboard aside {
  background: #0d1119;
  border-right: 1px solid #252c3b;
}

.saas-dashboard section {
  padding: 30px;
}

.dash-title {
  width: 200px;
  height: 20px;
  background: #293142;
  border-radius: 6px;
}

.dash-cards {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 15px;
  margin-top: 30px;
}

.dash-cards span,
.dash-table {
  background: #1a2230;
  border-radius: 12px;
}

.dash-cards span {
  height: 90px;
}

.dash-table {
  height: 160px;
  margin-top: 20px;
}

.saas-section,
.saas-pricing,
.faq {
  padding: 110px 8%;
}

.saas-heading {
  text-align: center;
  margin-bottom: 55px;
}

.saas-heading h2,
.integration h2,
.saas-pricing h2,
.faq h2 {
  font-size: clamp(38px,5vw,60px);
  margin: 15px 0;
  letter-spacing: -2px;
}

.saas-features {
  max-width: 1050px;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 18px;
}

.saas-features article {
  border: 1px solid #202735;
  background: #0e131d;
  border-radius: 20px;
  padding: 32px;
}

.saas-features b {
  color: #9a8cff;
  font-size: 30px;
}

.saas-features p {
  color: #8f96a7;
  line-height: 1.8;
}

.integration {
  padding: 100px 20px;
  text-align: center;
  background: #0d1119;
}

.integration-list {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 40px;
}

.integration-list span {
  padding: 14px 22px;
  border: 1px solid #292f3e;
  border-radius: 12px;
  color: #b6bbc8;
}

.saas-pricing {
  text-align: center;
}

.plans {
  max-width: 800px;
  margin: 45px auto 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.plans article {
  text-align: left;
  padding: 35px;
  border: 1px solid #252c3b;
  background: #0d121c;
  border-radius: 20px;
}

.plans .featured {
  border-color: #8d7aff;
}

.plans small {
  color: #9a8cff;
  letter-spacing: 2px;
}

.plans strong {
  display: block;
  font-size: 55px;
  margin: 18px 0;
}

.plans p {
  color: #8f96a7;
}

.outline-btn {
  padding: 13px 20px;
  border: 1px solid #394052;
  background: transparent;
  color: white;
  border-radius: 10px;
  cursor: pointer;
  font-weight: bold;
}

.faq {
  max-width: 900px;
  margin: auto;
}

.faq details {
  border-bottom: 1px solid #252c3b;
  padding: 22px 0;
}

.faq summary {
  cursor: pointer;
  font-weight: 700;
}

.faq details p {
  color: #9298a7;
  line-height: 1.7;
}

footer {
  border-top: 1px solid #202735;
  padding: 30px 8%;
  display: flex;
  justify-content: space-between;
  color: #737b8d;
}

@media(max-width:700px) {
  .saas-nav nav {
    display: none;
  }

  .saas-hero h1 {
    letter-spacing: -3px;
  }

  .saas-dashboard {
    grid-template-columns: 80px 1fr;
    height: 280px;
  }

  .saas-dashboard section {
    padding: 18px;
  }

  .saas-features,
  .plans {
    grid-template-columns: 1fr;
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelector(".saas-main-btn")?.addEventListener("click", function() {
  alert("Your free FlowOS workspace is ready!");
});
`,
  },

  {
    id: "gaming",
    name: "Gaming",
    category: "Gaming",
    description:
      "Dark gaming landing page with powerful visuals, news and community CTA.",
    icon: "🎮",
    prompt:
      "Create a premium dark gaming website with hero, game features, screenshots, news, community and CTA sections.",

    html: `
<header class="game-header">
  <a href="#" class="game-logo">VOID<span>RIFT</span></a>

  <nav>
    <a href="#game">Game</a>
    <a href="#features">Features</a>
    <a href="#news">News</a>
  </nav>

  <button class="play-btn">PLAY NOW</button>
</header>

<main>
  <section class="game-hero">
    <div class="game-hero-content">
      <span>SEASON 07 • AVAILABLE NOW</span>
      <h1>ENTER<br><b>THE RIFT.</b></h1>
      <p>
        A new generation of competitive action begins.
        Assemble your squad and enter the unknown.
      </p>
      <button class="play-btn hero-play">PLAY FREE →</button>
    </div>
  </section>

  <section id="game" class="game-intro">
    <span>THE WORLD</span>
    <h2>Nothing is what it seems.</h2>
    <p>
      Explore dangerous worlds, discover ancient technology
      and fight alongside your squad in an evolving universe.
    </p>
  </section>

  <section id="features" class="game-features">
    <article>
      <strong>01</strong>
      <h3>FAST COMBAT</h3>
      <p>Master movement, weapons and abilities to dominate every battle.</p>
    </article>

    <article>
      <strong>02</strong>
      <h3>BUILD YOUR SQUAD</h3>
      <p>Choose your role and create a team built for victory.</p>
    </article>

    <article>
      <strong>03</strong>
      <h3>EVOLVING WORLD</h3>
      <p>New maps, events and stories arrive every season.</p>
    </article>
  </section>

  <section id="news" class="game-news">
    <span>LATEST INTEL</span>
    <h2>What's happening?</h2>

    <div class="news-grid">
      <article>
        <div class="news-image">UPDATE</div>
        <small>JUNE 18, 2026</small>
        <h3>Season 07 is here.</h3>
      </article>

      <article>
        <div class="news-image second">EVENT</div>
        <small>JUNE 11, 2026</small>
        <h3>Rift Wars begins.</h3>
      </article>

      <article>
        <div class="news-image third">COMMUNITY</div>
        <small>JUNE 04, 2026</small>
        <h3>Meet the champions.</h3>
      </article>
    </div>
  </section>

  <section class="game-cta">
    <span>THE RIFT IS WAITING</span>
    <h2>Are you ready?</h2>
    <button class="play-btn final-play">ENTER THE RIFT →</button>
  </section>
</main>

<footer class="game-footer">
  <span>VOIDRIFT</span>
  <span>© 2026 VOIDRIFT STUDIOS</span>
</footer>
`,

    css: `
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: #070709;
  color: #fff;
  font-family: Inter, Arial, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

.game-header {
  height: 80px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5%;
  background: linear-gradient(rgba(0,0,0,.7),transparent);
}

.game-logo {
  font-size: 23px;
  font-weight: 1000;
  letter-spacing: 2px;
  font-style: italic;
}

.game-logo span {
  color: #ff315c;
}

.game-header nav {
  display: flex;
  gap: 28px;
}

.game-header nav a {
  color: #c7c7cc;
  font-size: 13px;
  font-weight: bold;
}

.play-btn {
  border: 0;
  background: #ff315c;
  color: #fff;
  padding: 12px 19px;
  font-weight: 900;
  cursor: pointer;
  clip-path: polygon(8% 0,100% 0,92% 100%,0 100%);
}

.game-hero {
  min-height: 90vh;
  display: flex;
  align-items: center;
  padding: 100px 8%;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(90deg,rgba(0,0,0,.9),rgba(0,0,0,.25)),
    radial-gradient(circle at 75% 40%,#7e2038,transparent 30%),
    #09090c;
}

.game-hero::after {
  content: "";
  position: absolute;
  width: 500px;
  height: 500px;
  right: 5%;
  border: 1px solid rgba(255,49,92,.3);
  transform: rotate(25deg);
  box-shadow: 0 0 100px rgba(255,49,92,.15);
}

.game-hero-content {
  max-width: 700px;
  position: relative;
  z-index: 2;
}

.game-hero-content > span,
.game-intro > span,
.game-news > span,
.game-cta > span {
  color: #ff315c;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 4px;
}

.game-hero h1 {
  font-size: clamp(65px,10vw,125px);
  line-height: .8;
  font-style: italic;
  margin: 25px 0;
  letter-spacing: -5px;
}

.game-hero h1 b {
  color: #ff315c;
}

.game-hero p {
  max-width: 570px;
  color: #a4a4ad;
  line-height: 1.8;
}

.hero-play {
  margin-top: 25px;
  padding: 15px 28px;
}

.game-intro {
  padding: 120px 20px;
  text-align: center;
  background: #0c0c10;
}

.game-intro h2,
.game-news h2,
.game-cta h2 {
  font-size: clamp(40px,6vw,70px);
  font-style: italic;
  margin: 18px 0;
}

.game-intro p {
  max-width: 650px;
  margin: auto;
  color: #8f9099;
  line-height: 1.8;
}

.game-features {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  border-block: 1px solid #24242b;
}

.game-features article {
  padding: 55px 35px;
  border-right: 1px solid #24242b;
  background: #08080b;
}

.game-features article:last-child {
  border: 0;
}

.game-features strong {
  color: #ff315c;
}

.game-features h3 {
  font-size: 20px;
  font-style: italic;
}

.game-features p {
  color: #858690;
  line-height: 1.7;
}

.game-news {
  padding: 110px 7%;
}

.news-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 18px;
}

.news-image {
  height: 260px;
  display: flex;
  align-items: flex-end;
  padding: 20px;
  font-size: 35px;
  font-weight: 900;
  font-style: italic;
  background:
    linear-gradient(135deg,#35111b,#a72a4b);
}

.news-image.second {
  background:
    linear-gradient(135deg,#12182e,#4658b5);
}

.news-image.third {
  background:
    linear-gradient(135deg,#132d27,#348d76);
}

.news-grid small {
  display: block;
  margin-top: 18px;
  color: #ff315c;
  font-size: 10px;
  letter-spacing: 2px;
}

.news-grid h3 {
  font-size: 22px;
  font-style: italic;
}

.game-cta {
  padding: 140px 20px;
  text-align: center;
  background:
    radial-gradient(circle,#45121f,transparent 50%),
    #0a0a0d;
}

.game-footer {
  border-top: 1px solid #24242b;
  padding: 30px 7%;
  display: flex;
  justify-content: space-between;
  color: #696a73;
  font-size: 11px;
  letter-spacing: 2px;
}

@media(max-width:700px) {
  .game-header nav {
    display: none;
  }

  .game-header {
    padding: 0 20px;
  }

  .game-hero h1 {
    letter-spacing: -3px;
  }

  .game-features,
  .news-grid {
    grid-template-columns: 1fr;
  }

  .game-features article {
    border-right: 0;
    border-bottom: 1px solid #24242b;
  }
}
`,

    js: `
document.querySelectorAll('a[href^="#"]').forEach(function(link) {
  link.addEventListener("click", function(e) {
    var target = document.querySelector(this.getAttribute("href"));

    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    }
  });
});

document.querySelectorAll(".play-btn").forEach(function(button) {
  button.addEventListener("click", function() {
    alert("Welcome to VOIDRIFT!");
  });
});
`,
  },
];

const CATEGORIES = [
  "All",
  "Business",
  "Portfolio",
  "Restaurant",
  "Landing Page",
  "SaaS",
  "Gaming",
];

function Templates() {
  const navigate = useNavigate();

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [usingTemplate, setUsingTemplate] = useState(null);

  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesCategory =
      category === "All" ||
      template.category === category;

    const query = search.trim().toLowerCase();

    const matchesSearch =
      !query ||
      template.name.toLowerCase().includes(query) ||
      template.category.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  // ========================================================
  // USE TEMPLATE
  // ========================================================

  async function handleUseTemplate(template) {
    if (usingTemplate) return;

    setUsingTemplate(template.id);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("User check error:", userError);
        alert("Could not verify your account.");
        setUsingTemplate(null);
        return;
      }

      if (!user) {
        alert("Please login first.");
        navigate("/login");
        setUsingTemplate(null);
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            user_id: user.id,
            name: `${template.name} Project`,
            type: template.category,
            prompt: template.prompt,
            html_code: template.html || "",
            css_code: template.css || "",
            js_code: template.js || "",
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(
          "Template project creation error:",
          error
        );

        alert(
          "Could not create project: " +
            error.message
        );

        setUsingTemplate(null);
        return;
      }

      navigate(`/builder/${data.id}`);
    } catch (error) {
      console.error("Template error:", error);

      alert(
        error?.message ||
          "Something went wrong while using the template."
      );

      setUsingTemplate(null);
    }
  }

  return (
    <div className="templates-page">

      {/* HEADER */}

      <header className="templates-header">

        <div className="templates-header-left">

          <button
            className="templates-back-btn"
            onClick={() => navigate("/dashboard")}
          >
            ←
          </button>

          <div>
            <span className="templates-label">
              WEB AI
            </span>

            <h1>
              Template Library
            </h1>

            <p>
              Start with a professionally
              designed website template.
            </p>
          </div>

        </div>

        <button
          className="templates-dashboard-btn"
          onClick={() => navigate("/dashboard")}
        >
          Dashboard
        </button>

      </header>


      {/* TOOLBAR */}

      <section className="templates-toolbar">

        <div className="template-search">

          <span>
            🔍
          </span>

          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
            >
              ×
            </button>
          )}

        </div>


        <div className="template-categories">

          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={
                category === item
                  ? "template-category active"
                  : "template-category"
              }
              onClick={() =>
                setCategory(item)
              }
            >
              {item}
            </button>
          ))}

        </div>

      </section>


      {/* CONTENT */}

      <main className="templates-content">

        <div className="templates-section-heading">

          <div>
            <span>
              {category === "All"
                ? "ALL TEMPLATES"
                : category.toUpperCase()}
            </span>

            <h2>
              Choose a starting point
            </h2>
          </div>

          <p>
            {filteredTemplates.length}{" "}
            {filteredTemplates.length === 1
              ? "template"
              : "templates"}
          </p>

        </div>


        {filteredTemplates.length === 0 ? (

          <div className="templates-empty">

            <div>🔍</div>

            <h3>
              No templates found
            </h3>

            <p>
              Try another search or category.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
            >
              Show all templates
            </button>

          </div>

        ) : (

          <div className="templates-grid">

            {filteredTemplates.map((template) => (

              <article
                className="template-card"
                key={template.id}
              >

                {/* PREVIEW */}

                <div className="template-preview">

                  <div className="template-preview-top">

                    <span>
                      WebAI
                    </span>

                    <div>
                      <i />
                      <i />
                      <i />
                    </div>

                  </div>

                  <div className="template-preview-body">

                    <div className="template-preview-orb">
                      {template.icon}
                    </div>

                    <div className="template-preview-line large" />
                    <div className="template-preview-line" />
                    <div className="template-preview-line short" />

                    <div className="template-preview-blocks">
                      <span />
                      <span />
                      <span />
                    </div>

                  </div>

                </div>


                {/* INFO */}

                <div className="template-card-info">

                  <div className="template-card-title">

                    <div className="template-icon">
                      {template.icon}
                    </div>

                    <div>
                      <h3>
                        {template.name}
                      </h3>

                      <span>
                        {template.category}
                      </span>
                    </div>

                  </div>

                  <p>
                    {template.description}
                  </p>

                  <button
                    type="button"
                    className="use-template-btn"
                    disabled={
                      usingTemplate !== null
                    }
                    onClick={() =>
                      handleUseTemplate(template)
                    }
                  >
                    {usingTemplate === template.id
                      ? "Creating Project..."
                      : "Use Template →"}
                  </button>

                </div>

              </article>

            ))}

          </div>

        )}

      </main>

    </div>
  );
}

export default Templates;