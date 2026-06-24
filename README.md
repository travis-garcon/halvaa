I have equipped you with many MCPs `Playwright, filesystem, Context7` to create a better environment for you to work more effieciently. I also installed some skills to give teach you some technics along the way to make better interfaces. The main thing that I want from this project is something like the below explantion. Read it and compare all the wanted things in it to what we have built so far and plan to add the ones that we don't have just yet: 


Halvaa.net is a web-based platform for creating and browsing digital memorials, designed to deliver a respectful, bright, and modern experience. The graphical theme must completely steer clear of dark, gloomy, or cemetery-like aesthetics, implementing instead a minimal light visual identity based on white and orange tones. The landing page must be multilingual, and the Hero section should display an image of celebrities or notable figures from the user's specific culture, depending on their selected language. New users should be able to quickly enter the memorial creation process, ensuring a simple, clear, and international onboarding experience from the very beginning.

The Explore section serves as the core hub for search and discovery, featuring two main modules: a dynamic and interactive grid interface inspired by the Apple Watch menu for browsing memorials, and a map tab powered by Mapbox that displays burial site locations. Clicking any point on the map should reveal the basic details of the memorials associated with that specific grave or burial plot. Both modules must be fast, smooth, responsive on mobile devices, and support various filters such as Featured, geographic distribution, most visited, or latest updates.

Each Memorial is built on a cohesive structure, receiving a unique ID and a public URL. The core content of the memorial is presented in a unified timeline that merges biographical narratives and chronologies, showcasing life events through text, images, videos, and geographical coordinates. Other sections of the memorial include: a Guestbook, messages and tributes, announcements, an image gallery, personal artifacts and belongings, identity documents, a last will and testament, a family tree, burial location details accompanied by real-time weather information, and a dedicated QR Code. Every memorial must have the capability to be translated into multiple languages.

The memorial system must support multi-user collaboration; the memorial owner can invite collaborators, and every section should allow for gradual, incremental editing. Identity management, access control, and user permissions will be handled securely via Zitadel. The publishing workflow includes the following stages: Draft, Pending Approval, Published, and Featured. Only approved memorials are eligible to appear on the landing page and the featured sections of Explore. Additionally, certain sections, such as messages or the guestbook, may require permissions or moderation by the memorial owner.

The proposed infrastructure consists of a decoupled architecture utilizing a Next.js frontend for high-performance rendering and a FastAPI backend for a rapid, type-safe, and asynchronous REST API layer. Zitadel serves as the unified identity provider (IdP), handling OpenID Connect (OIDC) / OAuth2 authentication flows, user profiling, and role-based access management across both frontend and backend.

Data persistence will be handled by a relational database like PostgreSQL (leveraging SQLAlchemy or SQLModel), alongside cloud storage for media assets. Maps must integrate seamlessly with Mapbox, and all media components should be loaded using compression, optimization, and lazy loading. The system must be designed from the ground up to be international, scalable, and optimized for both Iran's internet speeds and the global market to deliver a fast, smooth, and reliable user experience.

The overall structure of the previous halvaa.net site can serve as inspiration, but it must be executed with a brand-new user interface...

SPA navigation (Next.js App Router), SwiperJS carousels, Product Sans font for body text, on-scroll animations for the landing page... #mapbox_store_locator style nearby GeoJSON loading based on a given coordinate point or the client's location in the Explore section (served via high-performance FastAPI endpoint). Apply theme settings to the root CSS/Tailwind selector for seamless switching. Media optimization should be limited to thumbnails only (no more than one optimization layer, due to storage concerns).

Regarding Mapbox and the geo-system, I will handle any challenges or bottlenecks that arise.

Identity & Auth Architecture (Zitadel Integration)
Frontend Authentication: Next.js integrates with Zitadel using standard OIDC clients (e.g., next-auth / Auth.js or Zitadel's JS SDK) to handle secure PKCE login flows, token refreshing, and session state.

Backend Validation: FastAPI acts as a resource server. It will intercept incoming requests, extract the Bearer JWT token from the authorization header, and validate it using Zitadel's JWKS (JSON Web Key Sets) endpoint or via introspection.

Fine-Grained Permissions: Zitadel's Projects and Roles or Grants will be utilized to manage user types (Owner, Collaborator, Moderator, Admin). FastAPI will use these claims to determine if a collaborator has write-access to specific memorial modules (e.g., timeline events, guestbook moderation).

Multi-Tenancy Ready: Zitadel’s native organization structure easily supports future scaling if memorials need to be partitioned by organization or cultural institutes.# halvaa
