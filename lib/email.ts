// 전북대 이메일 인증용 메일 발송 헬퍼 — lib/db/index.ts와 동일하게 지연 초기화(lazy singleton)로 구현한다.
// (Proxy로 감싸면 안 되는 이유도 lib/db/index.ts 주석 참고 — 여기서도 평범한 함수 형태를 유지한다.)
//
// Resend 대신 Gmail SMTP를 쓴다: 이 프로젝트는 소유 도메인이 없어 Resend 도메인 인증을 할 수 없었고,
// Resend 샌드박스(onboarding@resend.dev)는 계정 소유자 본인 이메일로만 배달되는 제약이 있어 실제
// 학생 수신자에게 발송이 불가능했다. Gmail은 이미 검증된 발신 인프라라 도메인 인증 없이도 임의
// 수신자에게 보낼 수 있다 — 다만 개인 Gmail 계정 발신 한도(하루 약 500통)가 있으니 유의.
import 'server-only'

import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | undefined

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    const user = process.env.GMAIL_USER
    const pass = process.env.GMAIL_APP_PASSWORD
    if (!user || !pass) {
      throw new Error('GMAIL_USER/GMAIL_APP_PASSWORD가 설정되지 않았습니다.')
    }
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
  }
  return _transporter
}

export async function sendJbnuVerificationEmail(to: string, code: string): Promise<void> {
  const user = process.env.GMAIL_USER
  await getTransporter().sendMail({
    from: `먹메이트 <${user}>`,
    to,
    subject: '[먹메이트] 전북대 이메일 인증번호',
    html: `<p>안녕하세요, 먹메이트입니다.</p><p>전북대 이메일 인증번호는 <b style="font-size:20px">${code}</b> 입니다.</p><p>인증번호는 10분간 유효합니다.</p>`,
  })
}
