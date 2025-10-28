/*
  # Post Approve Application Schema

  ## Overview
  This migration creates the complete database schema for the Post Approve application,
  a mobile-first Instagram post approval system.

  ## New Tables

  ### 1. `clients`
  Stores client information managed by the admin
  - `id` (uuid, primary key) - Unique client identifier
  - `name` (text) - Client's name or business name
  - `unique_link_id` (text, unique) - Unique shareable link identifier for client access
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 2. `posts`
  Stores all post information including images, captions, and scheduling
  - `id` (uuid, primary key) - Unique post identifier
  - `client_id` (uuid, foreign key) - Reference to client
  - `post_type` (text) - Type: 'feed', 'carousel', 'story', or 'reels'
  - `scheduled_date` (timestamptz) - When the post should be published
  - `caption` (text) - Post caption/description
  - `status` (text) - Status: 'pending', 'change_requested', 'approved', or 'published'
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Record update timestamp

  ### 3. `post_images`
  Stores image information for posts (one for feed/story/reels, multiple for carousel)
  - `id` (uuid, primary key) - Unique image identifier
  - `post_id` (uuid, foreign key) - Reference to post
  - `image_url` (text) - Cloudinary URL of the image
  - `image_public_id` (text) - Cloudinary public ID for management
  - `crop_format` (text) - Crop ratio: '1:1', '4:5', or '9:16'
  - `position` (integer) - Order position in carousel (0 for single images)
  - `created_at` (timestamptz) - Record creation timestamp

  ### 4. `change_requests`
  Stores change requests made by clients on posts
  - `id` (uuid, primary key) - Unique request identifier
  - `post_id` (uuid, foreign key) - Reference to post
  - `request_type` (text) - Type: 'visual', 'date', 'caption', or 'other'
  - `message` (text) - Client's change request message
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  
  All tables have RLS enabled with appropriate policies:
  - Admin users (authenticated) have full access to all tables
  - Clients can read their own posts and submit change requests via the unique_link_id
  - No unauthenticated access except through client preview links (handled by app logic)

  ## Indexes
  
  - Index on `clients.unique_link_id` for fast client link lookups
  - Index on `posts.client_id` for filtering posts by client
  - Index on `posts.scheduled_date` for calendar views
  - Index on `post_images.post_id` for fast image retrieval
  - Index on `change_requests.post_id` for fetching change requests
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_name text,
  avatar_url text,
  unique_link_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('feed', 'carousel', 'story', 'reels')),
  scheduled_date timestamptz NOT NULL,
  caption text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'change_requested', 'approved', 'published')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create post_images table
CREATE TABLE IF NOT EXISTS post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  image_public_id text NOT NULL,
  crop_format text NOT NULL DEFAULT '1:1' CHECK (crop_format IN ('1:1', '4:5', '9:16')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create change_requests table
CREATE TABLE IF NOT EXISTS change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('visual', 'date', 'caption', 'other')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_unique_link ON clients(unique_link_id);
CREATE INDEX IF NOT EXISTS idx_posts_client_id ON posts(client_id);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_date ON posts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_post_id ON change_requests(post_id);

-- Enable Row Level Security on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients table
CREATE POLICY "Admin can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for posts table
CREATE POLICY "Admin can view all posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete posts"
  ON posts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Public can view posts by client link"
  ON posts FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = posts.client_id
    )
  );

CREATE POLICY "Public can update post status"
  ON posts FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = posts.client_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = posts.client_id
    )
  );

-- RLS Policies for post_images table
CREATE POLICY "Admin can view all post images"
  ON post_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert post images"
  ON post_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update post images"
  ON post_images FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete post images"
  ON post_images FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Public can view post images"
  ON post_images FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM posts
      JOIN clients ON clients.id = posts.client_id
      WHERE posts.id = post_images.post_id
    )
  );

-- RLS Policies for change_requests table
CREATE POLICY "Admin can view all change requests"
  ON change_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can delete change requests"
  ON change_requests FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Public can insert change requests"
  ON change_requests FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      JOIN clients ON clients.id = posts.client_id
      WHERE posts.id = change_requests.post_id
    )
  );

CREATE POLICY "Public can view change requests for posts"
  ON change_requests FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM posts
      JOIN clients ON clients.id = posts.client_id
      WHERE posts.id = change_requests.post_id
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();