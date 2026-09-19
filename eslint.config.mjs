import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // 型安全性を落とさないための方針（§34）
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      // SQL Injection 対策: Unsafe な raw クエリを禁止する（§31）
      'no-restricted-properties': [
        'error',
        {
          object: 'prisma',
          property: '$queryRawUnsafe',
          message: 'SQL Injection の恐れがあるため禁止。$queryRaw のタグ付きテンプレートを使うこと。',
        },
        {
          object: 'prisma',
          property: '$executeRawUnsafe',
          message: 'SQL Injection の恐れがあるため禁止。',
        },
      ],
      // XSS 対策: dangerouslySetInnerHTML を使わない（§31）
      'react/no-danger': 'error',
    },
  },
  {
    files: ['prisma/seed/**/*.ts', 'tests/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];

export default config;
