-- Create projects table
CREATE TABLE public.projects (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Untitled Project',
    thumbnail TEXT,
    canvas_data TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_images table
CREATE TABLE public.generated_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT NOT NULL,
    canvas_snapshot TEXT,
    action_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = user_id);

-- Generated images policies
CREATE POLICY "Users can view their project images" 
ON public.generated_images FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generated_images.project_id 
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can create images in their projects" 
ON public.generated_images FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generated_images.project_id 
    AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete their project images" 
ON public.generated_images FOR DELETE 
USING (EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = generated_images.project_id 
    AND projects.user_id = auth.uid()
));

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();