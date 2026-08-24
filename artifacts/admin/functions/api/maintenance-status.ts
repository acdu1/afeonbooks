export const onRequest: PagesFunction = async (context) => {
  const maintenance = context.env.MAINTENANCE === 'true';
  
  return new Response(
    JSON.stringify({
      maintenance,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    }
  );
};
