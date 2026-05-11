import { getDb } from '../storage/db';
import { getSectionsForPdf } from './pdf-sections';
import { getLinkedFolder, writeFileToFolder, readFileFromFolder } from '../storage/folder-access';

export interface SectionProgress {
  heading: string;
  sessionsCount: number;
  lastStudied: string;
  questionsAttempted: number;
  questionsCorrect: number;
  averageScore: number;
  weakPoints: string[];
  modalitiesUsed: string[];
}

export interface ProgressReport {
  pdfName: string;
  lastUpdated: string;
  totalSessions: number;
  sections: SectionProgress[];
  overallWeakPoints: string[];
  recommendations: string[];
}

export async function buildProgressReport(pdfId: string, pdfName: string): Promise<ProgressReport> {
  const db = await getDb();
  const sections = await getSectionsForPdf(pdfId);
  const sectionProgress: SectionProgress[] = [];
  const allWeakPoints: string[] = [];

  for (const section of sections) {
    const threads = await db.getAllFromIndex('threads', 'by-section', section.id);
    if (threads.length === 0) {
      sectionProgress.push({
        heading: section.heading,
        sessionsCount: 0,
        lastStudied: 'Not started',
        questionsAttempted: 0,
        questionsCorrect: 0,
        averageScore: 0,
        weakPoints: [],
        modalitiesUsed: [],
      });
      continue;
    }

    let questionsAttempted = 0;
    let questionsCorrect = 0;
    const weakPoints: string[] = [];
    const modalitiesUsed = new Set<string>();
    let latestTimestamp = 0;

    for (const thread of threads) {
      const messages = await db.getAllFromIndex('messages', 'by-thread', thread.id);
      for (const msg of messages) {
        if (msg.createdAt > latestTimestamp) latestTimestamp = msg.createdAt;

        if (msg.role === 'assistant') {
          const qMatch = msg.content.match(/```json\s*([\s\S]*?)```/);
          if (qMatch) {
            try {
              const q = JSON.parse(qMatch[1]!);
              if (q.modality) modalitiesUsed.add(q.modality);
            } catch { /* ignore */ }
          }

          const gradeMatch = msg.content.match(/"correct"\s*:\s*(true|false|"partial")/);
          if (gradeMatch) {
            questionsAttempted++;
            if (gradeMatch[1] === 'true') questionsCorrect++;
          }

          const feedbackMatch = msg.content.match(/"feedback"\s*:\s*"([^"]+)"/);
          if (feedbackMatch && gradeMatch && gradeMatch[1] !== 'true') {
            weakPoints.push(feedbackMatch[1]!);
          }
        }
      }
    }

    allWeakPoints.push(...weakPoints.slice(0, 3));

    sectionProgress.push({
      heading: section.heading,
      sessionsCount: threads.length,
      lastStudied: latestTimestamp ? new Date(latestTimestamp).toISOString().split('T')[0]! : 'Unknown',
      questionsAttempted,
      questionsCorrect,
      averageScore: questionsAttempted > 0 ? Math.round((questionsCorrect / questionsAttempted) * 100) : 0,
      weakPoints: weakPoints.slice(0, 5),
      modalitiesUsed: [...modalitiesUsed],
    });
  }

  const notStarted = sectionProgress.filter(s => s.sessionsCount === 0).map(s => s.heading);
  const struggling = sectionProgress.filter(s => s.averageScore > 0 && s.averageScore < 60).map(s => s.heading);
  const recommendations: string[] = [];
  if (struggling.length > 0) recommendations.push(`Review these sections (scored below 60%): ${struggling.join(', ')}`);
  if (notStarted.length > 0 && notStarted.length <= 5) recommendations.push(`Not yet started: ${notStarted.join(', ')}`);

  return {
    pdfName,
    lastUpdated: new Date().toISOString().split('T')[0]!,
    totalSessions: sectionProgress.reduce((sum, s) => sum + s.sessionsCount, 0),
    sections: sectionProgress,
    overallWeakPoints: allWeakPoints.slice(0, 10),
    recommendations,
  };
}

export function renderProgressMarkdown(report: ProgressReport): string {
  const lines: string[] = [
    `# ${report.pdfName} — Study Progress`,
    ``,
    `> Last updated: ${report.lastUpdated} · ${report.totalSessions} total sessions`,
    ``,
  ];

  if (report.recommendations.length > 0) {
    lines.push(`## Recommendations`, ``);
    for (const r of report.recommendations) lines.push(`- ${r}`);
    lines.push(``);
  }

  if (report.overallWeakPoints.length > 0) {
    lines.push(`## Weak Points`, ``);
    for (const w of report.overallWeakPoints) lines.push(`- ${w}`);
    lines.push(``);
  }

  lines.push(`## Sections`, ``);
  lines.push(`| Section | Sessions | Score | Last Studied |`);
  lines.push(`|---------|----------|-------|--------------|`);

  for (const s of report.sections) {
    const score = s.questionsAttempted > 0 ? `${s.averageScore}% (${s.questionsCorrect}/${s.questionsAttempted})` : '—';
    lines.push(`| ${s.heading} | ${s.sessionsCount} | ${score} | ${s.lastStudied} |`);
  }

  lines.push(``);

  const detailed = report.sections.filter(s => s.sessionsCount > 0);
  if (detailed.length > 0) {
    lines.push(`## Detail`, ``);
    for (const s of detailed) {
      lines.push(`### ${s.heading}`);
      lines.push(`- ${s.questionsAttempted} questions attempted, ${s.questionsCorrect} correct`);
      if (s.modalitiesUsed.length > 0) lines.push(`- Modalities: ${s.modalitiesUsed.join(', ')}`);
      if (s.weakPoints.length > 0) {
        lines.push(`- Areas to improve:`);
        for (const w of s.weakPoints) lines.push(`  - ${w}`);
      }
      lines.push(``);
    }
  }

  return lines.join('\n');
}

export async function exportProgressToFolder(pdfId: string, pdfName: string): Promise<boolean> {
  const folder = await getLinkedFolder();
  if (!folder) return false;

  const report = await buildProgressReport(pdfId, pdfName);
  const md = renderProgressMarkdown(report);
  const safeName = pdfName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_\- ]/g, '');
  await writeFileToFolder(folder, `${safeName} — progress.md`, md);
  return true;
}

export async function readProgressFromFolder(pdfName: string): Promise<string | null> {
  const folder = await getLinkedFolder();
  if (!folder) return null;

  const safeName = pdfName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_\- ]/g, '');
  return readFileFromFolder(folder, `${safeName} — progress.md`);
}
