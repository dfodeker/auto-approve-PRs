import * as core from '@actions/core';
import * as github from '@actions/github';

function parseBool(input: string | undefined, defaultValue: boolean): boolean {
  if (input === undefined || input === null || input === '') return defaultValue;
  const v = String(input).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  return defaultValue;
}

function parseList(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type CommitAuthor = {
  login?: string | null;
};

type CommitAuthorDetails = {
  name?: string | null;
  email?: string | null;
};

type CommitCommit = {
  author?: CommitAuthorDetails | null;
};

type PullRequestCommit = {
  sha: string;
  author?: CommitAuthor | null;
  commit?: CommitCommit | null;
};

async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true });
    const allowedBotLogins = parseList(core.getInput('allowed-bot-logins'));
    const requirePrAuthorIsBot = parseBool(
      core.getInput('require-pr-author-is-bot'),
      true
    );
    const skipDrafts = parseBool(core.getInput('skip-drafts'), true);
    const skipForks = parseBool(core.getInput('skip-forks'), true);

    const octokit = github.getOctokit(token);
    const context = github.context;
    const pr = context.payload.pull_request as any;

    if (!pr) {
      core.info('No pull_request in context; exiting.');
      return;
    }

    const { owner, repo } = context.repo;
    const pull_number: number = pr.number;

    if (skipDrafts && pr.draft) {
      core.info('PR is a draft; skipping auto-approval.');
      return;
    }

    if (skipForks && pr.head?.repo?.fork) {
      core.info('PR is from a fork; skipping auto-approval.');
      return;
    }

    if (requirePrAuthorIsBot) {
      const authorLogin: string = pr.user?.login ?? '';
      if (!allowedBotLogins.includes(authorLogin)) {
        core.info(
          `PR author ${authorLogin} is not in allowed-bot-logins; skipping.`
        );
        return;
      }
    }

    const commits = (await octokit.paginate(
      octokit.rest.pulls.listCommits,
      {
        owner,
        repo,
        pull_number,
        per_page: 100
      }
    )) as PullRequestCommit[];

    if (commits.length === 0) {
      core.info('No commits on this PR; skipping.');
      return;
    }

    const isAllowedBotCommit = (c: PullRequestCommit): boolean => {
      const login: string = c.author?.login ?? '';
      const name: string = c.commit?.author?.name ?? '';
      const email: string = c.commit?.author?.email ?? '';

      if (allowedBotLogins.includes(login)) return true;

      // Slightly fuzzy matching for common bot patterns, but still constrained to allowed logins.
      if (allowedBotLogins.some((bot) => name === bot)) return true;
      if (
        email &&
        allowedBotLogins.some((bot) =>
          email.endsWith(`${bot}@users.noreply.github.com`)
        )
      ) {
        return true;
      }

      return false;
    };

    const badCommit = commits.find((c) => !isAllowedBotCommit(c));

    if (badCommit) {
      core.info(
        `Found commit not authored by allowed bots (${badCommit.sha}); not auto-approving.`
      );
      return;
    }

    core.info(
      `All ${commits.length} commit(s) are from allowed bots [${allowedBotLogins.join(
        ', '
      )}]; creating approval review.`
    );

    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      event: 'APPROVE',
      body: 'Auto-approved: all commits on this PR were authored by allowed bots.'
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
