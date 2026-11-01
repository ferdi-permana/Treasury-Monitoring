export async function onScheduled(event, env, ctx) {

  const domain = "https://treasury-monitoring.pages.dev"; 
  await fetch(`${domain}/api/orderbook`, { method: "POST" });
}
