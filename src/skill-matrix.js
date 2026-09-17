// src/skill-matrix.js - Graviton V3.0.0 Antigravity Built-in Skills & Trigger Matrix

export const SKILL_TRIGGERS = [
  {
    keywords: ['ui', 'landing', 'css', 'html', 'tailwind', 'component', 'modal', 'navbar', 'responsive', 'frontend'],
    skill: 'modern-web-guidance',
    directive: 'Inject modern web standards (:has, container queries, zero-layout-shift, high-performance CSS).'
  },
  {
    keywords: ['flutter', 'dart', 'widget', 'app', 'mobile'],
    skill: 'flutter-apply-architecture-best-practices',
    directive: 'Apply layered reactive Flutter architecture (UI, Domain, Data) and automated unit test mocks.'
  },
  {
    keywords: ['firebase', 'auth', 'firestore', 'login', 'token', 'database', 'rules'],
    skill: 'firebase-firestore & firebase-auth-basics',
    directive: 'Apply secure Firestore security rules and structured auth error handling.'
  },
  {
    keywords: ['test', 'unit test', 'jest', 'vitest', 'spec', 'coverage'],
    skill: 'dart-add-unit-test / automated testing guidelines',
    directive: 'Execute complete test verification without mocks pollution or brittle selectors.'
  },
  {
    keywords: ['sql', 'bigquery', 'database', 'query', 'pipeline', 'etl'],
    skill: 'bigquery-sql & data-autocleaning',
    directive: 'Apply high-efficiency BigQuery optimization and automated data cleaning best practices.'
  },
  {
    keywords: ['stitch', 'design', 'figma', 'prototype', 'screen'],
    skill: 'stitch-mcp',
    directive: 'Utilize Google Stitch MCP for high-fidelity component synchronization.'
  }
];

export function resolveSkillDirectives(rawPrompt) {
  const promptLower = (rawPrompt || '').toLowerCase();
  const matched = [];

  for (const item of SKILL_TRIGGERS) {
    if (item.keywords.some(kw => promptLower.includes(kw))) {
      matched.push({ skill: item.skill, directive: item.directive });
    }
  }

  return matched;
}
