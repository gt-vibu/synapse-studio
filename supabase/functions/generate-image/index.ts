import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, canvasImage, actionType } = await req.json();
    
    console.log('Generating image with prompt:', prompt);
    console.log('Action type:', actionType);
    console.log('Has canvas image:', !!canvasImage);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the prompt based on action type - treat sketches as rough references only
    let enhancedPrompt = prompt;
    const referenceNote = canvasImage 
      ? "Use the provided sketch ONLY as a rough concept/idea reference. Do NOT copy the rough lines or shaky strokes. Instead, create a completely new, professionally designed image inspired by the general concept shown. " 
      : "";
    
    switch (actionType) {
      case 'logo':
        enhancedPrompt = `${referenceNote}Create a professional, modern, clean logo design: ${prompt}. The logo must be crisp, sharp, vector-quality with perfect lines and shapes. Minimalist, memorable, suitable for branding. Clean solid background. No rough edges or sketchy lines.`;
        break;
      case 'enhance':
        enhancedPrompt = `${referenceNote}Create a polished, professional version of this concept: ${prompt}. Transform into a refined, high-quality design with clean lines, perfect shapes, and professional aesthetics. Remove all roughness and imperfections.`;
        break;
      case '3d':
        enhancedPrompt = `${referenceNote}Create a stunning professional 3D render: ${prompt}. High-quality 3D visualization with realistic lighting, clean geometry, smooth surfaces, and dramatic shadows. Professional quality.`;
        break;
      case 'animation':
        enhancedPrompt = `${referenceNote}Create a professional animation-ready frame: ${prompt}. Clean vector-style art with smooth lines, vibrant colors, and professional animation quality. No rough sketchy elements.`;
        break;
      default:
        enhancedPrompt = `${referenceNote}Create a beautiful, professional, clean image: ${prompt}. High quality with crisp details, smooth lines, and polished finish. Transform any rough concepts into refined artwork.`;
    }

    // If there's a canvas image, include it in the request
    const messages: any[] = [];
    
    if (canvasImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `I'm providing a rough sketch as inspiration ONLY. Do not replicate the messy/shaky lines. Instead, understand the general concept/idea and create a completely NEW, professionally designed image. ${enhancedPrompt}`
          },
          {
            type: "image_url",
            image_url: {
              url: canvasImage
            }
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: enhancedPrompt
      });
    }

    console.log('Calling Lovable AI Gateway...');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages,
        modalities: ["image", "text"]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please check your Lovable workspace credits." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = data.choices?.[0]?.message?.content;

    if (!imageUrl) {
      console.error('No image in response:', data);
      throw new Error('No image generated');
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        description: textResponse || 'Image generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Error in generate-image function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
