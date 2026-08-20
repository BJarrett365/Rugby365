import { describe, expect, it } from "vitest";
import {
  parseRugbyPassCoachProfile,
  parseRugbyPassCoachSlug,
  rugbyPassCoachUrl,
} from "./parse-coach-profile";

describe("parseRugbyPassCoachSlug", () => {
  it("parses coach URLs and bare slugs", () => {
    expect(parseRugbyPassCoachSlug("https://www.rugbypass.com/coaches/rassie-erasmus/")).toBe(
      "rassie-erasmus",
    );
    expect(parseRugbyPassCoachSlug("rassie-erasmus")).toBe("rassie-erasmus");
    expect(rugbyPassCoachUrl("rassie-erasmus")).toBe(
      "https://www.rugbypass.com/coaches/rassie-erasmus/",
    );
  });
});

describe("parseRugbyPassCoachProfile", () => {
  it("extracts name, bio, and role from RugbyPass coach HTML", () => {
    const html = `
      <html><head>
        <meta property="og:title" content="Rassie Erasmus | RugbyPass" />
        <meta property="og:description" content="Rassie Erasmus is a former player who is now the Director of Rugby of the South African national team." />
        <meta property="og:image" content="https://eu-cdn.rugbypass.com/images/og/meta/generic.jpg" />
        <link rel="canonical" href="https://www.rugbypass.com/coaches/rassie-erasmus/" />
      </head><body>
        <h1>Rassie Erasmus Bio</h1>
        <p>Rassie Erasmus is a giant of South African rugby. After a stellar playing career where he represented South Africa on 36 occasions, he went into coaching.</p>
        <p>He is now the Director of Rugby for the South African national side, who he led to a Rugby World Cup victory in 2019 as the team’s head coach.</p>
        <h2>Fixtures</h2>
      </body></html>
    `;
    const profile = parseRugbyPassCoachProfile(
      html,
      "https://www.rugbypass.com/coaches/rassie-erasmus/",
    );
    expect(profile?.slug).toBe("rassie-erasmus");
    expect(profile?.displayName).toBe("Rassie Erasmus");
    expect(profile?.roleTitle).toMatch(/Director of Rugby/i);
    expect(profile?.currentTeam).toMatch(/South African/i);
    expect(profile?.bioSummary).toMatch(/giant of South African rugby/i);
    expect(profile?.imageUrl).toBeNull();
  });
});
