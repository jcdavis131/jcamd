/* GitHub contribution calendar.
 *
 * The calendar is not exposed by GitHub's REST API — only by GraphQL, which
 * requires a token. That is why this runs server-side rather than in the
 * browser like the rest of assets/github.js: a token cannot ship to the client.
 *
 * Needs env GITHUB_TOKEN. A fine-grained token with NO scopes is sufficient;
 * public contribution counts require no permissions. Without one the endpoint
 * returns 501 and the client hides the graph.
 */

const USER = 'jcdavis131';

const QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{
        totalContributions
        weeks{ contributionDays{ date contributionCount contributionLevel } }
      }
    }
  }
}`;

const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

module.exports = async (req, res) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(501).json({ error: 'no_token' });
    return;
  }

  try {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'User-Agent': 'jcamd.com',
      },
      body: JSON.stringify({ query: QUERY, variables: { login: USER } }),
    });

    if (!r.ok) throw new Error('github status ' + r.status);
    const body = await r.json();
    if (body.errors && body.errors.length) throw new Error(body.errors[0].message);

    const cal = body.data.user.contributionsCollection.contributionCalendar;
    const weeks = cal.weeks.map((w) =>
      w.contributionDays.map((d) => ({
        d: d.date,
        c: d.contributionCount,
        l: LEVELS[d.contributionLevel] ?? 0,
      }))
    );

    // Cheap to serve, changes at most daily. Cache at the edge.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ totalContributions: cal.totalContributions, weeks });
  } catch (err) {
    res.status(502).json({ error: 'upstream', detail: String(err.message || err) });
  }
};
