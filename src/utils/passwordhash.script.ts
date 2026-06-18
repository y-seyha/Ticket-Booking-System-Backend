import * as bcrypt from 'bcrypt';

async function generateHash() {
  const password = '12345678';
  const saltRounds = 10;

  const hash = await bcrypt.hash(password, saltRounds);

  console.log('Password:', password);
  console.log('Hash:', hash);
}

generateHash().catch((err) => {
  console.error('Error generating hash:', err);
});
