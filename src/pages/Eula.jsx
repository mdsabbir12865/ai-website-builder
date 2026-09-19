import { useEffect } from "react";
import { Link } from "react-router-dom";
import "../App.css";

const EFFECTIVE_DATE = "September 18, 2026";

function Eula() {
  useEffect(() => {
    document.title = "EULA · WebAI Builder";
  }, []);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand">
          <span className="legal-brand-icon">✦</span>
          WebAI Builder
        </Link>
        <nav className="legal-nav">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/">Home</Link>
        </nav>
      </header>

      <main className="legal-content">
        <p className="legal-eyebrow">Legal</p>
        <h1>End User License Agreement</h1>
        <p className="legal-meta">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <p>
          This End User License Agreement (“Agreement”) governs your access to
          and use of WebAI Builder (the “Service”), including the website
          builder, AI-assisted generation features, project tools, and optional
          integrations such as GitHub and Vercel deployment. By creating an
          account or using the Service, you agree to this Agreement.
        </p>

        <section>
          <h2>1. Eligibility and accounts</h2>
          <p>
            You must provide accurate account information and keep your login
            credentials secure. You are responsible for activity that occurs
            under your account. If you use the Service on behalf of an
            organization, you represent that you have authority to bind that
            organization to this Agreement.
          </p>
        </section>

        <section>
          <h2>2. License to use WebAI Builder</h2>
          <p>
            Subject to this Agreement, we grant you a limited, non-exclusive,
            non-transferable, revocable license to access and use WebAI Builder
            for your personal or internal business purposes. We retain all
            rights in the Service, including software, design, branding, and
            documentation. You may not copy, modify, distribute, reverse
            engineer, or create derivative works of the Service except as
            expressly allowed by law or this Agreement.
          </p>
        </section>

        <section>
          <h2>3. Generated websites and code</h2>
          <p>
            WebAI Builder lets you create, edit, export, and manage website
            projects (including HTML, CSS, JavaScript, prompts, uploads, and
            related assets). As between you and us, you retain ownership of the
            content you provide and the website code and assets generated for
            your projects, subject to:
          </p>
          <ul>
            <li>
              any rights of third-party providers whose models, libraries, or
              services are used to produce or host that content;
            </li>
            <li>
              our right to store, process, and transmit your project data as
              needed to operate the Service; and
            </li>
            <li>
              your responsibility to ensure that your content and generated
              output do not infringe others’ rights or violate applicable law.
            </li>
          </ul>
          <p>
            AI-generated output may be inaccurate, incomplete, or similar to
            content generated for other users. You are solely responsible for
            reviewing, testing, and deciding whether to use any generated
            website or code.
          </p>
        </section>

        <section>
          <h2>4. Vercel deployment integration</h2>
          <p>
            If you connect a Vercel account or use one-click deployment through
            WebAI Builder, you authorize us to request and use OAuth credentials
            and related metadata needed to create or link Vercel projects,
            submit deployments, and show deployment status and URLs in the
            Service. Your use of Vercel remains subject to Vercel’s own terms
            and policies. You are responsible for Vercel account settings,
            billing, domains, and any publicly reachable deployments you create.
          </p>
        </section>

        <section>
          <h2>5. GitHub and other optional connections</h2>
          <p>
            Optional GitHub connection features may allow repository creation,
            listing, and pushing of export files. Connecting GitHub authorizes
            us to store connection metadata and encrypted access credentials so
            we can perform those actions on your behalf. Your use of GitHub is
            subject to GitHub’s terms.
          </p>
        </section>

        <section>
          <h2>6. User responsibilities</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              use the Service for unlawful, harmful, deceptive, or abusive
              purposes;
            </li>
            <li>
              upload malware or attempt to disrupt, probe, or bypass security
              of the Service or third-party systems;
            </li>
            <li>
              misuse APIs, rate limits, or shared infrastructure;
            </li>
            <li>
              misrepresent the origin of generated websites or claim
              certifications or compliance that you have not independently
              verified; or
            </li>
            <li>
              use the Service in a way that infringes intellectual property,
              privacy, or other rights of others.
            </li>
          </ul>
        </section>

        <section>
          <h2>7. Intellectual property</h2>
          <p>
            WebAI Builder, including its name, logos, interface, and underlying
            software, is owned by us or our licensors. Feedback you provide may
            be used to improve the Service without obligation to you. Third-party
            marks (including Vercel and GitHub) belong to their respective
            owners.
          </p>
        </section>

        <section>
          <h2>8. Third-party services</h2>
          <p>
            The Service depends on third-party providers for authentication,
            database and file storage, AI generation, and optional GitHub and
            Vercel integrations. We do not control those providers and are not
            responsible for their availability, security practices, or changes
            to their APIs or terms. Your relationships with those providers are
            governed by their agreements with you.
          </p>
        </section>

        <section>
          <h2>9. Availability and changes</h2>
          <p>
            We strive to keep WebAI Builder available, but we do not guarantee
            uninterrupted or error-free operation. Features may change, be
            limited, or be discontinued. We may suspend access for maintenance,
            security, abuse prevention, or legal reasons.
          </p>
        </section>

        <section>
          <h2>10. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM
            EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, WHETHER
            EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS
            FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
            THAT GENERATED WEBSITES, DEPLOYMENTS, OR INTEGRATIONS WILL MEET YOUR
            REQUIREMENTS OR BE FREE OF DEFECTS.
          </p>
        </section>

        <section>
          <h2>11. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS WILL
            NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA,
            OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE OR ANY DEPLOYMENT
            OR INTEGRATION. OUR TOTAL LIABILITY FOR CLAIMS RELATING TO THE
            SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US
            FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR (B) ONE
            HUNDRED U.S. DOLLARS (US $100), IF YOU HAVE NOT PAID US.
          </p>
        </section>

        <section>
          <h2>12. Termination</h2>
          <p>
            You may stop using the Service at any time and may disconnect
            optional integrations such as Vercel or GitHub where those controls
            are available in the product. We may suspend or terminate access if
            you violate this Agreement or if we discontinue the Service. Upon
            termination, your license ends; provisions that by nature should
            survive (including intellectual property, disclaimers, limitations
            of liability, and termination) will survive.
          </p>
        </section>

        <section>
          <h2>13. Changes to this Agreement</h2>
          <p>
            We may update this Agreement from time to time. The effective date
            above will change when we post an updated version. Continued use of
            WebAI Builder after changes become effective constitutes acceptance
            of the updated Agreement. If you do not agree, you must stop using
            the Service.
          </p>
        </section>

        <section>
          <h2>14. Contact</h2>
          <p>
            Questions about this Agreement may be raised through the WebAI
            Builder product interface or the account/support channels made
            available in the Service. No separate support email address is
            published in this Agreement.
          </p>
        </section>

        <p className="legal-closing">
          By using WebAI Builder, you acknowledge that you have read and agree
          to this End User License Agreement.
        </p>
      </main>

      <footer className="legal-footer">
        <span>© 2026 WebAI Builder</span>
        <div className="legal-footer-links">
          <Link to="/eula">EULA</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}

export default Eula;
