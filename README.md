# Kusama Overview

> Validators explorer for [Kusama Network](https://kusama.network/)

![Preview image](preview.png)

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### App structure overview

Kusama Overview app consists of three parts:
- parser-light 
- api
- ui

With `parser-light` app is continuously check for the new blocks and save reqired information to the database.
`ui` part used to display the user interface and retrieve the actual data from the database using the `api`.  

### Prerequisites

You need to have [Docker](https://www.docker.com/) and docker-compose installed on your machine to start the application.

If you want to use the app without Docker you need to install next tools first:
- [MongoDB](https://www.mongodb.com/)
- [Node.js](https://nodejs.org)
- [Polkadot Node](https://github.com/paritytech/polkadot)

### Running the application locally with Docker

```
# Clone this repo to your local machine
git clone https://github.com/genesis-lab-team/kusama-overview.git
cd kusama-overview


# Set .env configurations from .env.example.docker

cd parser-light && cp .env.example.docker .env
cd ../api && cp .env.example.docker .env
cd ../ui && cp .env.example.docker .env && cd ..


# Start app with docker-compose
docker-compose up

# You can see the application running by visiting http://127.0.0.1:3001 url in your browser
```

### Manual installation

```
# Clone this repo to your local machine
git clone https://github.com/genesis-lab-team/kusama-overview.git
cd kusama-overview


# Install dependencies

npm ci
cd parser-light && npm ci
cd ../api && npm ci
cd ../ui && npm ci && cd ..


# Set .env configuration

cd parser-light && cp .env.example .env
cd ../api && cp .env.example .env
cd ../ui && cp .env.example .env && cd ..


# Start the application in development mode

npm run dev


# You can see the application running by visiting http://127.0.0.1:3001 url in your browser
```
