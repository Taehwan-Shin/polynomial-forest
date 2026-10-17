// Run locally as the teacher. Never ship this script or an admin key to students.
// The teacher must verify the student in person before resetting an account.
import { stdin, stdout } from 'node:process';
async function hidden(prompt) {
 if (!stdin.isTTY) throw new Error('Interactive terminal required');
 stdout.write(prompt); stdin.setRawMode(true); stdin.resume();
 return new Promise((resolve,reject) => {
  let input='';
  const done=()=>{stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');};
  const read=chunk=>{for(const c of chunk.toString('utf8')) {
   if(c==='\u0003') {done();reject(new Error('Cancelled'));return;}
   if(c==='\r'||c==='\n') {done();resolve(input);return;}
   if(c==='\u007f'||c==='\b') input=input.slice(0,-1);
   else if(c>=' ') input+=c;
  }};
  stdin.on('data',read);
 });
}
try {
 stdout.write('학생의 본인을 직접 확인한 뒤 진행하세요. 입력값은 화면과 로그에 표시하지 않습니다.\n');
 let key=await hidden('Supabase 관리자 secret API key: ');
 const username=(await hidden('학생 아이디: ')).trim().toLowerCase();
 let password=await hidden('새 임시 비밀번호(12자 이상): ');
 let confirm=await hidden('새 비밀번호 확인: ');
 if(password!==confirm) throw new Error('Mismatch');
 const result=await fetch('https://ahmcjuuomevfappsrkmh.supabase.co/functions/v1/forest-account',{
  method:'POST',headers:{'Content-Type':'application/json',apikey:key},body:JSON.stringify({action:'reset',username,password})
 });
 key=password=confirm='';
 if(!result.ok) throw new Error('Reset failed');
 stdout.write('재설정 완료. 이전 세션의 기록 접근은 차단되었습니다. 학생에게 비밀번호를 직접 전달하세요.\n');
} catch { stdout.write('재설정을 완료하지 못했습니다. 입력값·관리자 권한·네트워크를 확인하세요.\n');process.exitCode=1; }
