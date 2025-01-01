#!/usr/bin/env node

import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs";
import { execSync } from "child_process";

async function init() {
  console.log(chalk.green.bold("\nWelcome to express-app-init!\n"));

  // Questions for user input
  const answers = await inquirer.prompt([
    {
      name: "projectName",
      message: "Project Name",
      default: "server",
    },
    {
      name: "port",
      message: "Port Number",
      default: 3000,
      validate: (input) => {
        const port = Number(input);
        return port > 0 && port <= 65535
          ? true
          : "Please enter a valid port number (1-65535)";
      },
    },
    {
      type: "confirm",
      name: "initializeGit",
      message: "Would you like to initialize Git for this project?",
      default: true,
    },
    {
      type: "confirm",
      name: "useTypescript",
      message: "Would you like to use TypeScript?",
      default: true,
    },
    {
      type: "confirm",
      name: "setupPrisma",
      message: "Would you like to setup Prisma?",
      default: false,
    },
    {
      type: "confirm",
      name: "setupSupabase",
      message: "Would you like to setup Supabase?",
      default: false,
    },
    {
      type: "confirm",
      name: "createDockerfile",
      message: "Would you like to have a DockerFile?",
      default: true,
    },
    {
      type: "confirm",
      name: "installNodemon",
      message: "Would you like to install nodemon?",
      default: true,
    },
  ]);

  const {
    projectName,
    port,
    initializeGit,
    useTypescript,
    setupPrisma,
    setupSupabase,
    createDockerfile,
    installNodemon,
  } = answers;

  // Create project directory
  console.log(chalk.blue(`\nCreating project directory: ${projectName}`));
  fs.mkdirSync(projectName);
  process.chdir(projectName);

  // Create default folders
  const folders = [
    "config",
    "controller",
    "lib",
    "utils",
    "queries",
    "routes",
    "middlewares",
    "models",
  ];
  folders.forEach((folder) => fs.mkdirSync(folder));

  // Create default files
  console.log(chalk.blue("\nCreating default files..."));
  fs.writeFileSync(".gitignore", "node_modules\n.env");
  fs.writeFileSync("server.md", `# ${projectName} Backend`);
  fs.writeFileSync(".env", "", "utf-8");

  // Initialize npm project
  console.log(chalk.blue("\nInitializing npm project..."));
  execSync("npm init -y", { stdio: "inherit" });

  // Install base packages
  console.log(chalk.blue("\nInstalling dependencies..."));
  const dependencies = ["express", "dotenv"];
  const devDependencies = [];

  if (useTypescript) {
    devDependencies.push(
      "typescript",
      "@types/node",
      "@types/express",
      "ts-node",
      "tsconfig-paths"
    );
    fs.writeFileSync(
      "tsconfig.json",
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES6",
            module: "commonjs",
            rootDir: "./",
            outDir: "dist",
            esModuleInterop: true,
          },
        },
        null,
        2
      )
    );
  }

  if (installNodemon) devDependencies.push("nodemon");

  execSync(`npm install ${dependencies.join(" ")}`, { stdio: "inherit" });
  if (devDependencies.length > 0) {
    execSync(`npm install -D ${devDependencies.join(" ")}`, {
      stdio: "inherit",
    });
  }

  //Modify package.json scripts
  console.log(chalk.yellow("\nModifying package.json"));
  const packageJsonPath = "package.json";
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  packageJson.main = useTypescript ? "server.ts" : "server.js";
  packageJson.scripts = {
    start: useTypescript ? "ts-node server.ts" : "node server.js",
  };
  if (installNodemon) {
    packageJson.scripts.dev = useTypescript
      ? "nodemon --exec ts-node server.ts"
      : "nodemon server.js";
  }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Setup Prisma if required
  if (setupPrisma) {
    console.log(chalk.blue("\nSetting up Prisma..."));
    execSync("npm install prisma @prisma/client", {
      stdio: "inherit",
    });
    execSync("npx prisma init", { stdio: "inherit" });
  }

  // Create Dockerfile if required
  if (createDockerfile) {
    console.log(chalk.blue("\nCreating Dockerfile...\n"));
    fs.writeFileSync(
      "Dockerfile",
      `FROM node:lts
       WORKDIR /usr/src/app
       COPY package*.json ./
       RUN npm install
       COPY . .
       EXPOSE ${port}
       CMD ["npm", "start"]
      `
    );
  }

  // Setup Supabase if required
  if (setupSupabase) {
    console.log(chalk.blue("\nSetting up Supabase..."));
    if (setupPrisma) {
      const supabaseAnswers = await inquirer.prompt([
        { name: "username", message: "Enter your database username:" },
        { name: "password", message: "Enter your database password:" },
        { name: "host", message: "Enter your database host:" },
        { name: "port", message: "Enter your database port:" },
        { name: "database", message: "Enter your database name:" },
      ]);

      const {
        username,
        password,
        host,
        port: dbPort,
        database,
      } = supabaseAnswers;
      const databaseUrl = `postgresql://${username}:${password}@${host}:${dbPort}/${database}`;
      const envContent = fs.readFileSync(".env", "utf8");
      const updatedEnvContent = envContent
        .replace(/DATABASE_URL=.*/g, "")
        .trim();
      fs.writeFileSync(
        ".env",
        `${updatedEnvContent}\nDATABASE_URL=${databaseUrl}`
      );

      execSync("npm install @supabase/supabase-js", { stdio: "inherit" });
      const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";
      const dbFileContent = useTypescript
        ? `import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
export default prisma;`
        : `const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
module.exports = prisma;`;
      fs.writeFileSync(dbFileName, dbFileContent);
    } else {
      const supabaseAnswers = await inquirer.prompt([
        { name: "supabaseUrl", message: "Enter your Supabase URL:" },
        { name: "supabaseKey", message: "Enter your Supabase API Key:" },
      ]);

      const { supabaseUrl, supabaseKey } = supabaseAnswers;
      // Add Supabase URL and API Key to .env file
      const envContent = fs.readFileSync(".env", "utf8");
      const updatedEnvContent = envContent
        .replace(/SUPABASE_URL=.*/g, "")
        .replace(/SUPABASE_KEY=.*/g, "")
        .trim();
      fs.writeFileSync(
        ".env",
        `${updatedEnvContent}SUPABASE_URL=${supabaseUrl}\nSUPABASE_KEY=${supabaseKey}`
      );
      execSync("npm install @supabase/supabase-js", { stdio: "inherit" });
      // Create config/db.js or db.ts based on TypeScript choice
      const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";
      const dbFileContent = useTypescript
        ? `import { createClient } from "@supabase/supabase-js";
    const supabaseUrl: string = process.env.SUPABASE_URL!;
    const supabaseKey: string = process.env.SUPABASE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const fetchData = async (): Promise<void> => {
      try {
        const { data, error } = await supabase.from("your_table_name").select("*");
        if (error) throw error;
        console.log("Data:", data);
      } catch (err) {
        console.error("Error fetching data:", err.message);
      }
    };
    fetchData();
    `
        : `const { createClient } = require("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from("your_table_name").select("*");
        if (error) throw error;
        console.log("Data:", data);
      } catch (err) {
        console.error("Error fetching data:", err.message);
      }
    };
    fetchData();
    `;
      // Create the db file in the config folder
      fs.writeFileSync(dbFileName, dbFileContent);
    }
  } else {
    //ask whether u want to setup db locally
    const { setupDb } = await inquirer.prompt([
      {
        type: "confirm",
        name: "setupDb",
        message: "Would you like to setup local DB?",
        default: false,
      },
    ]);
    if (setupDb) {
      const { selectedDb } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedDb",
          message: "Which database are you going to use?",
          choices: ["postgres", "mysql", "mongodb"],
        },
      ]);
      switch (selectedDb) {
        case "postgres":
          console.log(chalk.blue("\nSetting up Postgres"));
          execSync("npm install pg", { stdio: "inherit" });
          if (setupPrisma) {
            const prismaSchema = fs.readFileSync(
              "prisma/schema.prisma",
              "utf8"
            );
            const updatedPrismaSchema = prismaSchema.replace(
              /provider = "(\w+)"/,
              'provider = "postgresql"'
            );
            fs.writeFileSync("prisma/schema.prisma", updatedPrismaSchema);
            const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";

            const dbFileContent = useTypescript
              ? `import { PrismaClient } from '@prisma/client';
  
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => console.log('Connected to database'))
    .catch((err) => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  
  export default prisma;`
              : `const { PrismaClient } = require('@prisma/client');
  
  const prisma = new PrismaClient();
  
  prisma.$connect()
    .then(() => console.log('Connected to database'))
    .catch((err) => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  
  module.exports = prisma;`;
            fs.writeFileSync(dbFileName, dbFileContent);
          } else {
            const nonPrismaEnv = `DB_HOST=localhost\nDB_USER=postgres\nDB_PASSWORD=password\nDB_NAME=my_database\nDB_PORT=5432`;
            fs.appendFileSync(".env", `${nonPrismaEnv}`);
            const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";

            const dbFileContent = useTypescript
              ? `import { Client } from 'pg';
  import dotenv from 'dotenv';
  
  dotenv.config();
  
  const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
  });
  
  client.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Error connecting to PostgreSQL:', err.stack));
  
  export default client;`
              : `const { Client } = require('pg');
  require('dotenv').config();
  
  const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 5432,
  });
  
  client.connect()
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Error connecting to PostgreSQL:', err.stack));
  
  module.exports = client;`;

            fs.writeFileSync(dbFileName, dbFileContent);
          }
          break;
        case "mysql":
          console.log(chalk.blue("\nSetting up MySQL: "));
          execSync("npm install mysql2", { stdio: "inherit" });
          if (setupPrisma) {
            const prismaSchema = fs.readFileSync(
              "prisma/schema.prisma",
              "utf8"
            );
            const updatedPrismaSchema = prismaSchema.replace(
              /provider = "(\w+)"/,
              'provider = "mysql"'
            );
            fs.writeFileSync("prisma/schema.prisma", updatedPrismaSchema);
            // Modify .env for Prisma
            const databaseUrl =
              "mysql://username:password@localhost:3306/my_database";
            const envContent = fs.readFileSync(".env", "utf8");
            const updatedEnvContent = envContent
              .replace(/DATABASE_URL=.*/g, "")
              .trim();
            fs.writeFileSync(
              ".env",
              `${updatedEnvContent}\nDATABASE_URL=${databaseUrl}`
            );
            // Create db.ts for Prisma
            const prismaDbContent = useTypescript
              ? `import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  prisma.$connect()
    .then(() => console.log('Connected to database'))
    .catch((err) => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  export default prisma;`
              : `const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.$connect()
    .then(() => console.log('Connected to database'))
    .catch((err) => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  module.exports = prisma;`;

            fs.writeFileSync(
              useTypescript ? "config/db.ts" : "config/db.js",
              prismaDbContent
            );
          } else {
            // Modify .env for non-Prisma
            const nonPrismaEnv = `DB_HOST=localhost\nDB_USER=root\nDB_PASSWORD=password\nDB_NAME=my_database`;
            fs.appendFileSync(".env", `${nonPrismaEnv}`);
            // Create db.ts for non-Prisma
            const mysqlDbContent = useTypescript
              ? `import mysql from 'mysql2';
  import dotenv from 'dotenv';
  dotenv.config();
  const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
  });
  export default connection;`
              : `const mysql = require('mysql2');
  require('dotenv').config();
  const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  connection.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL database');
  });
  module.exports = connection;`;

            fs.writeFileSync(
              useTypescript ? "config/db.ts" : "config/db.js",
              mysqlDbContent
            );
          }
          break;
        case "mongodb":
          console.log(chalk.blue("\nSetting up MongoDB: "));
          // Install mongoose and mongodb packages
          execSync("npm install mongoose mongodb", { stdio: "inherit" });
          // Check if Prisma is present
          if (setupPrisma) {
            // Modify .env for Prisma
            const databaseUrl =
              "mongodb+srv://username:password@cluster.mongodb.net/my_database?retryWrites=true&w=majority";
            const envContent = fs.readFileSync(".env", "utf8");
            const updatedEnvContent = envContent
              .replace(/DATABASE_URL=.*/g, "")
              .trim();
            fs.writeFileSync(
              ".env",
              `${updatedEnvContent}\nDATABASE_URL=${databaseUrl}`
            );
            // Update Prisma schema
            const prismaSchema = fs.readFileSync(
              "prisma/schema.prisma",
              "utf8"
            );
            const updatedPrismaSchema = prismaSchema.replace(
              /provider = "(\w+)"/,
              'provider = "mongodb"'
            );
            fs.writeFileSync("prisma/schema.prisma", updatedPrismaSchema);
            const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";
            const prismaDbContent = useTypescript
              ? `import { PrismaClient } from '@prisma/client';
  const prisma = new PrismaClient();
  prisma
    .$connect()
    .then(() => console.log('Connected to database'))
    .catch(err => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  export default prisma;`
              : `const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma
    .$connect()
    .then(() => console.log('Connected to database'))
    .catch(err => console.error('Error connecting to database:', err))
    .finally(() => prisma.$disconnect());
  module.exports = prisma;`;

            fs.writeFileSync(dbFileName, prismaDbContent);
          } else {
            // MongoDB connection prompt
            const { isMongoLocal } = await inquirer.prompt([
              {
                type: "list",
                name: "isMongoLocal",
                message: "Is MongoDB local or Atlas?",
                choices: ["local", "atlas"],
              },
            ]);
            let mongoUrl = "";
            if (isMongoLocal === "local") {
              mongoUrl = 'MONGODB_URI="mongodb://localhost:27017/my_database"';
            } else {
              mongoUrl =
                'MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/my_database?retryWrites=true&w=majority"';
            }
            fs.appendFileSync(".env", `${mongoUrl}`);
            const dbFileName = useTypescript ? "config/db.ts" : "config/db.js";
            const dbFileContent = useTypescript
              ? `import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));
export default mongoose;
`
              : `const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));
module.exports = mongoose;
`;
            // Write the file
            fs.writeFileSync(dbFileName, dbFileContent);
          }
          break;
        default:
          console.log(chalk.red("Invalid Database Selection."));
      }
    } else {
      console.log(chalk.blue("\nskipping DB Configuration setup.\n"));
    }
  }
  fs.appendFileSync(".env", `\nPORT=${port}`);
  // Create routes file
  const routeFileName = useTypescript ? "routes/route.ts" : "routes/route.js";
  const routeFileContent = useTypescript
    ? `import { Router } from \"express\";
const route = Router();
export default route;
`
    : `const { Router } = require(\"express\");
const route = Router();
module.exports = route;
`;
  fs.writeFileSync(routeFileName, routeFileContent);

  // Create server file
  const serverFileName = useTypescript ? "server.ts" : "server.js";
  const serverFileContent = useTypescript
    ? `import express from \"express\";
import dotenv from \"dotenv\";
import route from \"./routes/route\";

dotenv.config();

const app = express();

app.use(express.json());
const port: number = parseInt(process.env.PORT || \"${port}\", 10) || ${port};

app.use(\"/api\", route);

app.listen(port, () => console.log(\`App is listening at port \${port}\`));
`
    : `const express = require(\"express\");
const dotenv = require(\"dotenv\");
const route = require(\"./routes/route\");

dotenv.config();

const app = express();

app.use(express.json());
const port = parseInt(process.env.PORT || \"${port}\", 10) || ${port};

app.use(\"/api\", route);

app.listen(port, () => console.log(\`App is listening at port \${port}\`));
`;
  fs.writeFileSync(serverFileName, serverFileContent);

  // Optional Packages Installation
  const optionalPackages = [
    { name: "jsonwebtoken", typePackage: "@types/jsonwebtoken" },
    { name: "bcrypt", typePackage: "@types/bcrypt" },
    { name: "cors", typePackage: "@types/cors" },
    { name: "cookie-parser", typePackage: "@types/cookie-parser" },
    { name: "nodemailer", typePackage: "@types/nodemailer" },
  ];

  console.log(chalk.blue("\nWould you like to install optional packages?\n"));

  const selectedPackages = [];

  for (const pkg of optionalPackages) {
    const { install } = await inquirer.prompt([
      {
        type: "confirm",
        name: "install",
        message: `Install ${pkg.name}?`,
        default: false,
      },
    ]);

    if (install) {
      selectedPackages.push(pkg);
    }
  }

  if (selectedPackages.length > 0) {
    console.log(chalk.blue("\nInstalling selected packages..."));

    // Install the main packages
    const packagesToInstall = selectedPackages.map((pkg) => pkg.name).join(" ");
    execSync(`npm install ${packagesToInstall}`, { stdio: "inherit" });

    // Install the type packages if using TypeScript
    if (useTypescript) {
      const typePackagesToInstall = selectedPackages
        .map((pkg) => pkg.typePackage)
        .filter(Boolean) // Filter out undefined type packages
        .join(" ");
      if (typePackagesToInstall) {
        execSync(`npm install -D ${typePackagesToInstall}`, {
          stdio: "inherit",
        });
      }
    }

    console.log(chalk.green("\nSelected packages installed successfully!\n"));
  } else {
    console.log(
      chalk.yellow("\nNo packages selected. Skipping installation.\n")
    );
  }

  if (initializeGit) {
    try {
      execSync("git init", { stdio: "inherit" });
      console.log(chalk.blue.bold("\nGit has been initialized.\n"));
    } catch (err) {
      console.error(chalk.red("\nError initializing Git:", err.message));
    }
  }

  console.log(chalk.green("\nProject setup complete!\n"));
}

init();
