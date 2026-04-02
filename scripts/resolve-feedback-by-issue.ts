/**
 * Bulk-resolve feedback records whose linked GitHub issues have been closed.
 *
 * Usage:
 *   npx ts-node scripts/resolve-feedback-by-issue.ts --summary "Fixed in v1.6.1" 623 624 625 ...
 *
 * For each issue number:
 *   1. Finds the feedback record with that githubIssueNumber
 *   2. Updates status to "resolved"
 *   3. Sends a resolution notification email with the summary to the submitting user
 */

import { PrismaClient } from "@prisma/client";
import { EmailService } from "../src/services/emailService";

function parseArgs(argv: string[]): {
  summary: string;
  issueNumbers: number[];
} {
  const args = argv.slice(2);
  let summary = "This has been fixed and deployed.";
  const issueNumbers: number[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--summary" && args[i + 1]) {
      summary = args[++i];
    } else {
      const n = Number(args[i]);
      if (n) issueNumbers.push(n);
    }
  }

  return { summary, issueNumbers };
}

async function main() {
  const { summary, issueNumbers } = parseArgs(process.argv);

  if (issueNumbers.length === 0) {
    console.error(
      'Usage: npx ts-node scripts/resolve-feedback-by-issue.ts [--summary "..."] <issue> [issue...]',
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const emailService = new EmailService();

  console.log(
    `Resolving feedback for GitHub issues: ${issueNumbers.join(", ")}`,
  );
  console.log(`Summary: "${summary}"\n`);

  let resolved = 0;
  let skipped = 0;

  for (const issueNumber of issueNumbers) {
    const record = await prisma.feedbackRequest.findFirst({
      where: { githubIssueNumber: issueNumber },
      include: { user: { select: { email: true } } },
    });

    if (!record) {
      console.log(`  #${issueNumber}: no feedback record found — skipping`);
      skipped++;
      continue;
    }

    if (record.status === "resolved") {
      console.log(`  #${issueNumber}: already resolved — skipping`);
      skipped++;
      continue;
    }

    await prisma.feedbackRequest.update({
      where: { id: record.id },
      data: {
        status: "resolved",
        reviewedAt: new Date(),
      },
    });

    if (record.user?.email) {
      try {
        await emailService.sendFeedbackStatusEmail(record.user.email, {
          title: record.title,
          status: "resolved",
          resolutionSummary: summary,
        });
        console.log(
          `  #${issueNumber}: resolved + notified ${record.user.email}`,
        );
      } catch (err) {
        console.log(
          `  #${issueNumber}: resolved but email failed — ${err instanceof Error ? err.message : err}`,
        );
      }
    } else {
      console.log(`  #${issueNumber}: resolved (no email on file)`);
    }

    resolved++;
  }

  console.log(`\nDone: ${resolved} resolved, ${skipped} skipped`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
