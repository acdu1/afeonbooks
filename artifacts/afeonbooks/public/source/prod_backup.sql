--
-- PostgreSQL database dump
--

\restrict xLoEzwp0WoZ0Ltoo60MPghuDOXg6OltNkU8UIDij3pRqPFil77tnnOZ3XHV4d8Z

-- Dumped from database version 16.12 (7bcf9ab)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _system; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

CREATE SCHEMA _system;


ALTER SCHEMA _system OWNER TO neondb_owner;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: replit_database_migrations_v1; Type: TABLE; Schema: _system; Owner: neondb_owner
--

CREATE TABLE _system.replit_database_migrations_v1 (
    id bigint NOT NULL,
    build_id text NOT NULL,
    deployment_id text NOT NULL,
    statement_count bigint NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE _system.replit_database_migrations_v1 OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE; Schema: _system; Owner: neondb_owner
--

CREATE SEQUENCE _system.replit_database_migrations_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNER TO neondb_owner;

--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: _system; Owner: neondb_owner
--

ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNED BY _system.replit_database_migrations_v1.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    product_id integer NOT NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price_cents integer NOT NULL
);


ALTER TABLE public.order_items OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.order_items_id_seq OWNER TO neondb_owner;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    customer_name text NOT NULL,
    customer_email text NOT NULL,
    customer_phone text NOT NULL,
    classroom text,
    notes text,
    payment_method text DEFAULT 'cash_on_delivery'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal_cents integer NOT NULL,
    shipping_cents integer DEFAULT 0 NOT NULL,
    total_cents integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    shipping_address text NOT NULL,
    city text NOT NULL,
    postal_code text NOT NULL,
    country text NOT NULL,
    use_default_address text DEFAULT 'false'::text NOT NULL,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    utm_term text,
    utm_content text,
    referrer text,
    landing_page text
);


ALTER TABLE public.orders OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO neondb_owner;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price_cents integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    image_url text DEFAULT ''::text NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO neondb_owner;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.products_id_seq OWNER TO neondb_owner;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: site_content; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.site_content (
    id integer NOT NULL,
    brand_name text NOT NULL,
    nav_home_label text NOT NULL,
    hero_title text NOT NULL,
    hero_subtitle text NOT NULL,
    cta_label text NOT NULL,
    cta_url text NOT NULL,
    cover_image_url text NOT NULL,
    about_heading text NOT NULL,
    about_body text NOT NULL,
    authors_line text NOT NULL,
    illustrator_line text NOT NULL,
    footer_note text NOT NULL,
    accent_color text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    default_shipping_label text DEFAULT ''::text NOT NULL,
    default_shipping_address text DEFAULT ''::text NOT NULL,
    default_shipping_city text DEFAULT ''::text NOT NULL,
    default_shipping_postal_code text DEFAULT ''::text NOT NULL,
    default_shipping_country text DEFAULT ''::text NOT NULL,
    email_enabled text DEFAULT 'false'::text NOT NULL,
    email_from_name text DEFAULT 'AFEON Books'::text NOT NULL,
    email_from_address text DEFAULT 'onboarding@resend.dev'::text NOT NULL,
    email_reply_to text DEFAULT ''::text NOT NULL,
    email_subject text DEFAULT 'Your order #{{orderId}} is confirmed!'::text NOT NULL,
    email_heading text DEFAULT 'Thank you for your order!'::text NOT NULL,
    email_intro text DEFAULT 'Hi {{customerName}},

Thanks for ordering from AFEON Books! Your order #{{orderId}} has been received and is being prepared. You''ll pay {{total}} in cash on delivery.'::text NOT NULL,
    email_button_label text DEFAULT 'View your order'::text NOT NULL,
    email_footer text DEFAULT 'Questions about your order? Just reply to this email.'::text NOT NULL,
    email_accent_color text DEFAULT '#E2553B'::text NOT NULL
);


ALTER TABLE public.site_content OWNER TO neondb_owner;

--
-- Name: site_content_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.site_content_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.site_content_id_seq OWNER TO neondb_owner;

--
-- Name: site_content_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.site_content_id_seq OWNED BY public.site_content.id;


--
-- Name: replit_database_migrations_v1 id; Type: DEFAULT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1 ALTER COLUMN id SET DEFAULT nextval('_system.replit_database_migrations_v1_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: site_content id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.site_content ALTER COLUMN id SET DEFAULT nextval('public.site_content_id_seq'::regclass);


--
-- Data for Name: replit_database_migrations_v1; Type: TABLE DATA; Schema: _system; Owner: neondb_owner
--

COPY _system.replit_database_migrations_v1 (id, build_id, deployment_id, statement_count, applied_at) FROM stdin;
1	91e9347b-b3c1-41fa-97d8-cbe08fff6c10	d68f8198-d085-4c30-a459-04b2d116a586	7	2026-04-24 18:07:22.435697+00
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.order_items (id, order_id, product_id, product_name, quantity, unit_price_cents) FROM stdin;
11	11	8	The Terror Of The Evil Capybara — Book One	1	1500
12	12	8	The Terror Of The Evil Capybara — Book One	1	1500
13	13	8	The Terror Of The Evil Capybara — Book One	1	1500
14	14	8	The Terror Of The Evil Capybara — Book One	1	1500
15	15	8	The Terror Of The Evil Capybara — Book One	1	1500
16	15	5	The Terror Of The Evil Capybara Official Shirt	1	1000
17	16	8	The Terror Of The Evil Capybara — Book One	1	1500
18	17	8	The Terror Of The Evil Capybara — Book One	1	1500
19	18	3	Water Bottle Stickers	1	500
20	19	8	The Terror Of The Evil Capybara — Book One	1	1500
21	20	8	The Terror Of The Evil Capybara — Book One	1	1500
22	21	8	The Terror Of The Evil Capybara — Book One	1	1500
23	22	8	The Terror Of The Evil Capybara — Book One	1	1500
24	23	8	The Terror Of The Evil Capybara — Book One	1	1500
25	24	8	The Terror Of The Evil Capybara — Book One	1	1500
26	25	8	The Terror Of The Evil Capybara — Book One	1	1500
27	26	10	The Terror Of The Evil Capybara Bookmark	1	100
28	27	8	The Terror Of The Evil Capybara — Book One	1	1500
29	28	8	The Terror Of The Evil Capybara — Book One	1	1500
30	29	8	The Terror Of The Evil Capybara — Book One	1	1500
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.orders (id, customer_name, customer_email, customer_phone, classroom, notes, payment_method, status, subtotal_cents, shipping_cents, total_cents, currency, created_at, shipping_address, city, postal_code, country, use_default_address, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, landing_page) FROM stdin;
16	Wanqi	kellyliu657657@gmail.com	5037036851	A3	For Ms. Liu. So proud of you!	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:39:25.620982+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
17	joelle chou	joellechou14@gmail.com	s1004040867stu.rowlandschools.org	A3	hi guys, I will advertise you stuff on YouTube for free but, I will not accept money but I will offer this deal if you agree and sign my book.	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:42:05.079703+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	\N	\N	\N	\N	\N	\N	\N
18	joelle chou	joellechou14@gmail.com	s1004040867stu.rowlandschools.org	A3	its the same offer!  : D	cash_on_delivery	confirmed	500	0	500	USD	2026-05-01 16:52:34.375945+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	\N	\N	\N	\N	\N	\N	\N
19	Isabel  Hsu	isabel.hsu@rowlandschools.org	9099199291	D3	This order is for Ms. Hsu (D3). Thank you and I can't wait to read  it.	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:58:56.216772+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
24	Freda Su	lky961027@gmail.com	6263203739	B4		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-04 03:51:22.779447+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
20	Maeva Baker	petitegardenlife@gmail.com	1004047391	Maeva Baker (Mrs. Voong- B3)	Please let me know when the book arrives, and I will give the cash to Maeva. Thank you, Jamie Baker	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 19:17:02.275142+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	https://classroom.google.com/	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
21	jian	wq855519@gmail.com	1004047652	B3	this is for 3rd grade  Cindy Yang  	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-02 04:01:05.216745+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	https://classroom.google.com/	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
22	Ethan Hong	karenleialt@gmail.com	s1004040258	A-9 or A-10	:)	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-03 02:24:25.896123+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	https://classroom.google.com/	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
11	Brittany Maturan	brittany.maturan@rowlandschools.org	s100	A9	Please sign my book	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:14:46.77226+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
12	Ray Kuo	ray.mightypups@gmail.com	s1004041720@stu.rowlandschools.org	basketball court		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:35:18.468607+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
13	Corrie	corrie_roes@icloud.com	s1004040241	A3	please put signatures 	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:36:54.062399+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	\N	\N	\N	\N	\N	\N	\N
14	Jocelyn Tsui	Jocelynt8888@gmail.com	s1004041827@stu.rowlandschools.org	A-3	kjhgtr	cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-01 16:37:16.878657+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	\N	\N	\N	\N	\N	\N	\N
15	Ethan Edlin Buscaino	ethan.buscaino@gmail.com	s1004036899@stu.rowlandschools.org	Room A3	GIVE ME A DISCOUNT OR I WILL BE MAD	cash_on_delivery	confirmed	2500	0	2500	USD	2026-05-01 16:37:32.27406+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
23	Samuel Liu	mathisreallyfun@gmail.com	s1004047524	room b3		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-03 22:53:25.192766+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	https://classroom.google.com/	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
25	Daniel Bailey	sulikabailey@gmail.com	1004047308	Hsu D3		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-04 17:46:41.001078+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
26	Angela	Angela7tian@gmail.com	s1004043654@stu.rowlandschools.org	A-3	Hi ya'lls products are amazing :D	cash_on_delivery	confirmed	100	0	100	USD	2026-05-07 21:14:52.170297+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	\N	\N	\N	\N	\N	\N	\N
27	Arthur Melendez	arthur.melendez@rowlandschools.org	STAFF	A-1		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-08 20:18:41.96827+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
28	Vanessa Mia Lin	meini_w@hotmail.com	s1004045245	D3		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-09 03:31:50.179813+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	https://classroom.google.com/	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
29	Grace Voong	gvoong@rowlandschools.org	s1004040621	A3		cash_on_delivery	confirmed	1500	0	1500	USD	2026-05-09 22:26:39.261968+00	19500 S. Nacora St.	Rowland Heights	91748	USA	true	3ly	donationform	totecpreorder	\N	\N	\N	/?utm_source=3ly&utm_medium=donationform&utm_campaign=totecpreorder
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.products (id, name, description, price_cents, currency, image_url, stock, active, created_at) FROM stdin;
8	The Terror Of The Evil Capybara — Book One	When terror reveals itself to the detectives, it comes in the form of a fury little capybara with glasses. What happens when these two enemies go head to head? Who will win the duel? Good? Or evil? Join the detectives, White Dragon, Evanzilla, Naomi Da Apple and Kevin as they try to win the battle against evil and also do dangerous things while at it, like jumping off skyscrapers.	1500	USD	https://static.wixstatic.com/media/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg/v1/fill/w_584,h_751,al_c,q_85,usm_0.66_1.00_0.01/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg	26	t	2026-04-27 22:02:22.629672+00
5	The Terror Of The Evil Capybara Official Shirt	Buy this shirt that has a awesome drawing of the characters!	1000	USD	https://t4.ftcdn.net/jpg/03/15/18/09/360_F_315180932_rhiXFrJN27zXCCdrgx8V5GWbLd9zTHHA.jpg	99	t	2026-04-27 20:10:28.039944+00
7	The Evil Capybara Takeover Shirt	Buy this shirt that has a awesome drawing of the evil capybara!	1000	USD	https://t4.ftcdn.net/jpg/03/15/18/09/360_F_315180932_rhiXFrJN27zXCCdrgx8V5GWbLd9zTHHA.jpg	100	t	2026-04-27 20:12:32.491621+00
12	White Dragon Shirt	Show your White Dragon character from this exclusive shirt with a White Dragon Illustration, by White Dragon herself!-Only sold here!	1000	USD	https://i.ibb.co/wNtQsNfV/Screenshot-2026-05-01-19-16-00.png	100	t	2026-05-02 02:16:41.107843+00
6	The Terror Of The Evil Capybara x AFEON Books Collab Official Shirt	Embrace the madness with this exclusive Terror of the Evil Capybara shirt, a special collaboration with AFEON Books! Featuring a breathtaking, high-quality illustration of the beloved (and slightly chaotic) characters, this shirt brings the story to life. Crafted for comfort and style, it’s the perfect gear for fans.	1000	USD	https://i.ibb.co/0VBcFmMJ/Screenshot-2026-04-27-15-06-39.png	100	t	2026-04-27 20:11:15.063866+00
11	The EVIL Bundle	Comes with book, bookmark, stickers, and a shirt!	3300	USD	https://t4.ftcdn.net/jpg/03/15/18/09/360_F_315180932_rhiXFrJN27zXCCdrgx8V5GWbLd9zTHHA.jpg	100	t	2026-05-02 00:00:03.357779+00
10	The Terror Of The Evil Capybara Bookmark	Bookmark of The Terror Of The Evil Capybara.	100	USD	https://i.ibb.co/QjjHXZcm/TOTEC-Bookmark.png	99	t	2026-05-01 23:59:23.984368+00
3	Water Bottle Stickers	Celebrate the release of The Terror Of The Evil Capybara Book 1 with these special stickers-Only Sold Here!	500	USD	https://t4.ftcdn.net/jpg/03/15/18/09/360_F_315180932_rhiXFrJN27zXCCdrgx8V5GWbLd9zTHHA.jpg	99	t	2026-04-27 16:43:16.348675+00
\.


--
-- Data for Name: site_content; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.site_content (id, brand_name, nav_home_label, hero_title, hero_subtitle, cta_label, cta_url, cover_image_url, about_heading, about_body, authors_line, illustrator_line, footer_note, accent_color, updated_at, default_shipping_label, default_shipping_address, default_shipping_city, default_shipping_postal_code, default_shipping_country, email_enabled, email_from_name, email_from_address, email_reply_to, email_subject, email_heading, email_intro, email_button_label, email_footer, email_accent_color) FROM stdin;
1	AFEON Books	Home	The Terror Of The Evil Capybara	PREORDERS ARE OPEN AGAIN, BUT WILL CLOSE AGAIN ON THE 17th of MAY. If you can't preorder however, you may purchase a book during the pick-up event. The date of the pick-up event is: (WILL BE ANNOUNCED SOON)\n\nWritten by 6th Graders. Preorder this book now! \n\nBy Evan Lee, Janis Vong, Francis Kawibawa, Naomi Tsao, Olivia Chang and Aiden Chen.	Read Sample (Right Click and open in New Tab)	https://editor.reedsy.com/s/DDfLMPz	https://static.wixstatic.com/media/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg/v1/fill/w_584,h_751,al_c,q_85,usm_0.66_1.00_0.01/91d5eb_b2c9e6441ca74cf0ad33c5b8935b9ffe~mv2.jpg	The Terror Of The Evil Capybara - Book 1	When terror reveals itself to the detectives, it comes in the form of a fury little capybara with glasses. What happens when these two enemies go head to head? Who will win the duel? Good? Or evil? Join the detectives, White Dragon, Evanzilla, Naomi Da Apple and Kevin as they try to win the battle against evil and also do dangerous things while at it, like jumping off skyscrapers.	Francis Kawibawa, Naomi Tsao, Olivia Chang, Evan Lee, Janis Vong, Aiden Chen.	Janis Vong	© 2026 AFR Group. All Rights Reserved.	#57c1e2	2026-05-12 15:35:51.938+00	Shelyn Elementary School - PREORDERS	19500 S. Nacora St.	Rowland Heights	91748	USA	true	AFEON Books	aidenechen@outlook.com	aidenechen@outlook.com	Your order #{{orderId}} is confirmed!	Thank you for your order!	Hi {{customerName}},\n\nThanks for ordering from AFEON Books! Your order #{{orderId}} has been received. You'll pay {{total}} in cash on the pickup day. If you have a coupon, please bring it upon delivery. Pickup day will be announced on the preorder website, so stay in touch!	View your order	Questions about your order? Just reply to this email.	#57c1e2
\.


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE SET; Schema: _system; Owner: neondb_owner
--

SELECT pg_catalog.setval('_system.replit_database_migrations_v1_id_seq', 1, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.order_items_id_seq', 30, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.orders_id_seq', 29, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.products_id_seq', 12, true);


--
-- Name: site_content_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.site_content_id_seq', 1, true);


--
-- Name: replit_database_migrations_v1 replit_database_migrations_v1_pkey; Type: CONSTRAINT; Schema: _system; Owner: neondb_owner
--

ALTER TABLE ONLY _system.replit_database_migrations_v1
    ADD CONSTRAINT replit_database_migrations_v1_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.site_content
    ADD CONSTRAINT site_content_pkey PRIMARY KEY (id);


--
-- Name: idx_replit_database_migrations_v1_build_id; Type: INDEX; Schema: _system; Owner: neondb_owner
--

CREATE UNIQUE INDEX idx_replit_database_migrations_v1_build_id ON _system.replit_database_migrations_v1 USING btree (build_id);


--
-- Name: order_items order_items_order_id_orders_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_orders_id_fk FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

\unrestrict xLoEzwp0WoZ0Ltoo60MPghuDOXg6OltNkU8UIDij3pRqPFil77tnnOZ3XHV4d8Z

