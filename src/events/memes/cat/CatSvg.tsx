// 오리지널 고양이 실루엣. 저작권 문제가 있는 기존 캐릭터/짤을 쓰지 않고 기본 도형만으로
// 직접 그렸다 (EVENTS_SPEC.md 6장). 나중에 사진/그림 에셋으로 교체하려면 이 컴포넌트
// 대신 <img src="/events/meme/cat/..."/>를 쓰도록 CatMeme.tsx만 바꾸면 된다.

export default function CatSvg() {
  return (
    <svg width="72" height="56" viewBox="0 0 72 56" aria-hidden="true">
      {/* 꼬리 */}
      <path
        d="M 8 40 Q -4 30 6 18"
        stroke="#4a4a4a"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* 몸통 */}
      <ellipse cx="34" cy="38" rx="26" ry="14" fill="#4a4a4a" />
      {/* 다리 */}
      <rect x="16" y="46" width="6" height="9" rx="3" fill="#3a3a3a" />
      <rect x="48" y="46" width="6" height="9" rx="3" fill="#3a3a3a" />
      {/* 머리 */}
      <circle cx="56" cy="24" r="14" fill="#4a4a4a" />
      {/* 귀 */}
      <path d="M 46 14 L 44 2 L 54 12 Z" fill="#4a4a4a" />
      <path d="M 66 14 L 70 2 L 58 12 Z" fill="#4a4a4a" />
      {/* 얼굴 */}
      <circle cx="51" cy="23" r="2" fill="#fff" />
      <circle cx="61" cy="23" r="2" fill="#fff" />
      <path d="M 54 29 Q 56 31 58 29" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* 수염 */}
      <path d="M 44 26 L 36 24 M 44 29 L 36 30" stroke="#ddd" strokeWidth="1" strokeLinecap="round" />
      <path d="M 68 26 L 76 24 M 68 29 L 76 30" stroke="#ddd" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
