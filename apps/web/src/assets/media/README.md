# Assets / Media Guide

이 디렉터리는 웹 클라이언트에서 공유할 로고 및 정적 이미지를 보관하기 위한 용도입니다.

- `logos/`: 회사/브랜드 로고, 파비콘, 파트너 로고.
- `illustrations/`: 빈 상태(Empty state)나 배경 등에 쓰이는 이미지.

## 사용 방법

정적 파일로 임포트하거나 URL로 참조할 수 있습니다.

```tsx
import brandLogo from '@/assets/media/logos/Lemetree_logo.svg';

export function HeaderLogo() {
  return <img src={brandLogo} alt="Lremettre ERP" height={32} />;
}
```

혹은 Vite의 `new URL` 구문으로 접근할 수 있습니다.

```ts
const heroUrl = new URL('@/assets/media/illustrations/hero.png', import.meta.url).href;
```

## 운영 규칙

1. 파일명은 소문자 케밥케이스(`main-logo.svg`)를 기본으로 하되, 레거시 자산(`Lemetree_logo.svg`)은 그대로 유지합니다.
2. SVG, PNG, WebP 등 최적화된 포맷을 사용하며 필요 시 `svgo`, `squoosh` 등으로 압축합니다.
3. 새 이미지를 추가하면 어느 화면에서 쓰이는지 PR 설명에 간단히 남겨주세요.
