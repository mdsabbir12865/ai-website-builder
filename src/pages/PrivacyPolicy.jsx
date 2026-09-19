import { useEffect } from "react";
import { Link } from "react-router-dom";
import "../App.css";

const EFFECTIVE_DATE = "September 18, 2026";

function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy · WebAI Builder";
  }, []);

  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link to="/" className="legal-brand">
          <span className="legal-brand-icon">✦</span>
          WebAI Builder
        </Link>
        <nav className="legal-nav">
          <Link to="/eula">EULA</Link>
          <Link to="/">Home</Link>
        </nav>
      </header>

      <main className="legal-content">
        <p className="legal-eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="legal-meta">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <p>
          This Privacy Policy explains how WebAI Builder (“we”, “us”, or “the
          Service”) collects, uses, stores, and shares information when you use
          our AI website builder and related features, including optional GitHub
          and Vercel integrations. It describes practices that apply to our
          current application. It does not claim certifications, regulatory
          compliance badges, or data practices that are not implemented.
        </p>

        <section>
          <h2>1. Information we collect</h2>

          <h3>Account information</h3>
          <p>
            When you register or sign in, we process account credentials and
            profile details associated with authentication, such as email
            address, password (handled by our authentication provider), and any
            name or metadata you choose to provide in your user profile.
          </p>

          <h3>Project and website data</h3>
          <p>
            We store the projects you create in WebAI Builder, which may include
            project names, types, prompts, generated or edited HTML/CSS/JavaScript,
            uploaded files and file metadata, and related builder settings needed
            to edit, preview, export, or deploy your websites.
          </p>

          <h3>GitHub connection data</h3>
          <p>
            If you connect GitHub, we may store connection identifiers and
            profile metadata (such as GitHub user id, username, avatar URL, and
            granted scopes), encrypted access credentials, and repository or
            branch references associated with your projects so we can create or
            list repositories and push export files on your behalf.
          </p>

          <h3>Vercel connection and deployment data</h3>
          <p>
            If you connect Vercel or use one-click deployment, we may store:
          </p>
          <ul>
            <li>
              encrypted Vercel OAuth access tokens and related connection
              metadata (such as configuration id, Vercel user id, username,
              avatar URL, team id, and scopes);
            </li>
            <li>
              linked Vercel project identifiers and names on your WebAI Builder
              projects; and
            </li>
            <li>
              deployment history such as deployment ids, status, URLs, related
              GitHub repository/branch references when used, timestamps, and
              error messages from failed attempts.
            </li>
          </ul>

          <h3>Authentication and session data</h3>
          <p>
            We use session and authentication tokens so you can remain signed in
            and call protected API endpoints. Short-lived OAuth state values may
            be used during GitHub or Vercel connection flows to help prevent
            cross-site request forgery.
          </p>

          <h3>API and usage-related data</h3>
          <p>
            When you use features such as AI generation, file upload, GitHub
            actions, or Vercel deploy/status endpoints, our servers process the
            requests needed to perform those actions. We may retain operational
            records that are part of those features (for example deployment
            status rows) rather than a separate marketing analytics product.
          </p>
        </section>

        <section>
          <h2>2. How we use information</h2>
          <p>We use the information above to:</p>
          <ul>
            <li>provide, maintain, and secure WebAI Builder accounts;</li>
            <li>create, save, preview, export, and manage website projects;</li>
            <li>
              run optional integrations with GitHub and Vercel, including
              connecting accounts and deploying websites;
            </li>
            <li>
              process AI generation and other product API requests you initiate;
              and
            </li>
            <li>
              troubleshoot errors, prevent abuse, and improve reliability of the
              Service.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. Storage and security</h2>
          <p>
            Account authentication, project data, file metadata, and integration
            records are stored using our backend providers (including Supabase
            for authentication, database, and file storage). Vercel and GitHub
            access tokens are stored in server-side connection tables and are
            intended to be encrypted at rest by our API layer; browser clients
            are not given direct access to those token tables. Access to
            protected deploy and connection APIs requires an authenticated user
            session. No security measure is perfect, and we do not claim
            certification or guarantee that unauthorized access can never occur.
          </p>
        </section>

        <section>
          <h2>4. Retention</h2>
          <p>
            We retain account, project, upload, connection, and deployment data
            for as long as needed to provide the Service and the features you
            use. If you delete projects or disconnect integrations where those
            controls are available, we remove or stop using the related
            connection data according to how those features are implemented.
            Backup copies or logs held by infrastructure providers may persist
            for a limited period after deletion. We do not publish a fixed
            retention schedule beyond these operational needs.
          </p>
        </section>

        <section>
          <h2>5. Sharing and third-party services</h2>
          <p>
            We share data with service providers only as needed to operate
            WebAI Builder, including:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — authentication, database, and file
              storage;
            </li>
            <li>
              <strong>AI model providers</strong> — prompts and related content
              you submit for website generation;
            </li>
            <li>
              <strong>GitHub</strong> — if you connect GitHub, to authorize and
              perform repository actions you request;
            </li>
            <li>
              <strong>Vercel</strong> — if you connect Vercel or deploy, to
              authorize the integration, create or link projects, and create or
              query deployments.
            </li>
          </ul>
          <p>
            Those providers process data under their own terms and privacy
            policies. We do not sell your personal information. We may disclose
            information if required by law or to protect the Service, users, or
            others from harm or abuse.
          </p>
        </section>

        <section>
          <h2>6. Your choices and rights</h2>
          <p>Depending on how you use the Service, you may be able to:</p>
          <ul>
            <li>access and update account details through authentication flows;</li>
            <li>create, edit, export, or delete projects and uploaded files;</li>
            <li>
              connect or disconnect GitHub and Vercel integrations where those
              controls are provided in the product; and
            </li>
            <li>stop using WebAI Builder at any time.</li>
          </ul>
          <p>
            If you need help with account or data requests, use the support
            channels available in the WebAI Builder product interface. Applicable
            privacy laws may give you additional rights; we will respond to
            valid requests through those product channels to the extent we can
            identify and act on your account.
          </p>
        </section>

        <section>
          <h2>7. International processing</h2>
          <p>
            WebAI Builder and its providers may process and store information in
            the United States or other countries where those providers operate.
            If you use the Service from another location, you understand that
            your information may be transferred to and processed in those
            locations.
          </p>
        </section>

        <section>
          <h2>8. Children’s privacy</h2>
          <p>
            WebAI Builder is not directed to children, and we do not knowingly
            collect personal information from children for the purpose of
            offering the Service to them. If you believe a child has provided
            account information, contact us through the product support channels
            so we can take appropriate action.
          </p>
        </section>

        <section>
          <h2>9. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy as the Service changes. When we
            do, we will revise the effective date above. Continued use of
            WebAI Builder after an update means you acknowledge the revised
            policy.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            For privacy questions about WebAI Builder, use the account or
            support options available inside the Service. This policy does not
            publish a separate support email address because one is not listed
            in the current application.
          </p>
        </section>
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

export default PrivacyPolicy;
