// Explicit owner recovery starts platform authentication; it never grants a role by itself.
export async function GET(){return new Response(null,{status:303,headers:{Location:'/signin-with-chatgpt?return_to=%2F','Cache-Control':'no-store','Set-Cookie':'yingyai-owner-signed-out=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}})}
